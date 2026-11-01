(ns shop.orders
  "Order pricing, validation and reporting."
  (:require [clojure.string :as str]
            [clojure.set :as set]
            [clojure.tools.logging :as log])
  (:import (java.time Instant)))

(def ^:const tax-rate 0.0825)
(def ^:const free-shipping-over 75.0)
(def max-lines 0x40)
(def sku-pattern #"^[A-Z]{3}-\d{5}$")

(def statuses #{:pending :paid :shipped :cancelled})

(defrecord Line [sku qty unit-price])
(defrecord Order [id email lines status placed-at])

(defn line-total
  "Price of a single line before tax."
  [{:keys [qty unit-price]}]
  (* qty unit-price))

(defn subtotal [order]
  (->> (:lines order)
       (map line-total)
       (reduce + 0.0)))

(defn total [order]
  (-> (subtotal order)
      (* (+ 1 tax-rate))
      (* 100) Math/round (/ 100.0)))

(defn validate
  "Returns the order or throws ex-info with the offending SKUs."
  [order]
  (let [bad (->> (:lines order)
                 (remove #(re-matches sku-pattern (:sku %)))
                 (map :sku))]
    (cond
      (empty? (:lines order)) (throw (ex-info "Order has no lines" {:id (:id order)}))
      (seq bad)               (throw (ex-info "Invalid SKUs" {:skus (vec bad)}))
      (not (statuses (:status order))) (throw (ex-info "Unknown status" {:status (:status order)}))
      :else order)))

(defn describe [{:keys [id email status] :as order}]
  (case status
    :pending   (format "#%d awaiting payment from %s" id (or email "guest"))
    :shipped   (str "#" id " shipped\t(free: " (>= (subtotal order) free-shipping-over) ")")
    :cancelled nil
    (str "#" id " is " (name status))))

;; TODO: replace the atom with a proper datastore once we pick one
(defonce store (atom {}))

(defn place! [order]
  (try
    (let [o (validate (assoc order :placed-at (Instant/now) :status :pending))]
      (swap! store assoc (:id o) o)
      {:ok true :total (total o)})
    (catch clojure.lang.ExceptionInfo e
      (log/warn "rejected order" (ex-data e))
      {:ok false :error (ex-message e)})))

(comment
  (place! (->Order 1042 "ana@example.com" [(->Line "TEA-00042" 2 18.5)] :pending nil))
  (->> @store vals (map describe) (str/join "\n"))
  (set/difference statuses #{:cancelled}))
