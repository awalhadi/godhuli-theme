{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE DerivingStrategies #-}

-- | Pure order pricing and validation for the storefront.
module Orders
  ( Order (..)
  , Status (..)
  , Line (..)
  , total
  , validate
  , checkout
  ) where

import Data.Char (isDigit, isUpper)
import Data.Maybe (fromMaybe)
import qualified Data.Map.Strict as Map
import Data.Text (Text)
import qualified Data.Text as T

data Status = Pending | Paid | Shipped Text | Cancelled
  deriving stock (Show, Eq)

data Line = Line
  { lineSku   :: Text
  , lineQty   :: Int
  , linePrice :: Double
  } deriving stock (Show)

data Order = Order
  { orderId    :: Int
  , orderEmail :: Maybe Text
  , orderLines :: [Line]
  , orderState :: Status
  } deriving stock (Show)

class Priced a where
  price :: a -> Double

instance Priced Line where
  price (Line _ q p) = fromIntegral q * p

instance Priced Order where
  price = sum . map price . orderLines

taxRate, freeShippingOver :: Double
taxRate = 0.0825
freeShippingOver = 75.0

-- | Total including tax, rounded to cents.
total :: Order -> Double
total o = fromIntegral (round (price o * (1 + taxRate) * 100) :: Int) / 100

shipping :: Order -> Double
shipping o
  | price o >= freeShippingOver = 0
  | null (orderLines o)          = 0
  | otherwise                    = 4.99

validate :: Order -> Either Text Order
validate o
  | null (orderLines o) = Left "order has no lines"
  | any (not . validSku . lineSku) (orderLines o) = Left "invalid SKU"
  | otherwise = Right o
  where
    validSku s = case T.splitOn "-" s of
      [cat, num] -> T.length cat == 3 && T.all isUpper cat && T.all isDigit num
      _          -> False

-- TODO: thread a real payment gateway through a ReaderT environment
checkout :: Map.Map Int Order -> Int -> IO (Either Text Text)
checkout db oid = do
  let found = Map.lookup oid db
  case found >>= either (const Nothing) Just . validate of
    Nothing -> pure (Left ("order " <> T.pack (show oid) <> " not found or invalid"))
    Just o  -> do
      let email = fromMaybe "guest" (orderEmail o)
      putStrLn $ "Charging " <> show (total o + shipping o) <> "\t(0x" <> "1F)"
      pure (Right ("receipt sent to " <> email))
