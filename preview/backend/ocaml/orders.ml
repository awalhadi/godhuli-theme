(** Order pricing and an in-memory order store. *)

type status =
  | Pending
  | Paid of float  (** unix timestamp *)
  | Shipped of { carrier : string; tracking : string }
  | Cancelled

type line = { sku : string; qty : int; unit_price : float }

type order = {
  id : int;
  email : string option;
  lines : line list;
  mutable status : status;
}

let tax_rate = 0.0825
let free_shipping_over = 75.0
let max_lines = 0x40
let sku_re = Str.regexp {|^[A-Z][A-Z][A-Z]-[0-9]+$|}

exception Invalid_order of string

let subtotal o = List.fold_left (fun acc l -> acc +. (float l.qty *. l.unit_price)) 0. o.lines

let total o = Float.round (subtotal o *. (1. +. tax_rate) *. 100.) /. 100.

let describe o =
  match o.status with
  | Pending when o.lines = [] -> "empty draft"
  | Pending -> Printf.sprintf "#%d awaiting payment" o.id
  | Paid ts -> Printf.sprintf "#%d paid at %.0f" o.id ts
  | Shipped { carrier; tracking } -> Printf.sprintf "#%d via %s (%S)" o.id carrier tracking
  | Cancelled -> "cancelled"

let validate o =
  if List.length o.lines > max_lines then raise (Invalid_order "too many lines");
  match List.find_opt (fun l -> not (Str.string_match sku_re l.sku 0)) o.lines with
  | Some bad -> Error ("invalid SKU: " ^ bad.sku)
  | None -> Ok o

module type KEY = sig
  type t
  val compare : t -> t -> int
end

(** A functor producing a simple keyed store. *)
module MakeStore (K : KEY) = struct
  module M = Map.Make (K)

  type 'a t = { mutable rows : 'a M.t }

  let create () = { rows = M.empty }
  let put s k v = s.rows <- M.add k v s.rows
  let find s k = M.find_opt k s.rows
  let size s = M.cardinal s.rows
end

module OrderStore = MakeStore (Int)

let () =
  let store = OrderStore.create () in
  let o = { id = 1042; email = None; lines = [ { sku = "TEA-00042"; qty = 2; unit_price = 18.5 } ];
            status = Pending } in
  OrderStore.put store o.id o;
  (* TODO: persist to disk instead of keeping everything in memory *)
  match validate o with
  | Ok o ->
      let who = Option.value o.email ~default:"guest" in
      Printf.printf "%s: %s, total $%.2f\n" who (describe o) (total o)
  | Error msg -> prerr_endline msg
