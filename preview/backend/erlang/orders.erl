%%% @doc Order tracking process for the fulfilment service.
%%% Keeps a map of order references to their current status.
-module(orders).
-behaviour(gen_server).

-export([start_link/0, place/2, status/1, ship/2]).
-export([init/1, handle_call/3, handle_cast/2, handle_info/2]).

-define(SERVER, ?MODULE).
-define(TIMEOUT, 5000).
-define(TAX_RATE, 0.0825).

-record(order, {
    ref       :: binary(),
    lines = [] :: [{binary(), pos_integer(), float()}],
    status = pending :: pending | paid | shipped | cancelled,
    tracking = undefined :: binary() | undefined
}).

%%% API

start_link() ->
    gen_server:start_link({local, ?SERVER}, ?MODULE, #{}, []).

-spec place(binary(), list()) -> {ok, binary()} | {error, term()}.
place(Ref, Lines) when is_binary(Ref), is_list(Lines), Lines =/= [] ->
    gen_server:call(?SERVER, {place, #order{ref = Ref, lines = Lines}}, ?TIMEOUT);
place(_Ref, _Lines) ->
    {error, empty_order}.

status(Ref) -> gen_server:call(?SERVER, {status, Ref}).

ship(Ref, Tracking) -> gen_server:cast(?SERVER, {ship, Ref, Tracking}).

%%% Callbacks

init(State) ->
    erlang:send_after(60000, self(), sweep),
    {ok, State}.

handle_call({place, #order{ref = Ref} = O}, _From, State) ->
    case maps:is_key(Ref, State) of
        true  -> {reply, {error, duplicate}, State};
        false -> {reply, {ok, Ref}, State#{Ref => O}}
    end;
handle_call({status, Ref}, _From, State) ->
    Reply = case maps:find(Ref, State) of
        {ok, #order{status = S, lines = L}} -> {S, total(L)};
        error -> not_found
    end,
    {reply, Reply, State}.

handle_cast({ship, Ref, Tracking}, State) ->
    %% TODO: reject shipments for cancelled orders
    case State of
        #{Ref := O} -> {noreply, State#{Ref := O#order{status = shipped, tracking = Tracking}}};
        _ -> {noreply, State}
    end.

handle_info(sweep, State) ->
    io:format("~p orders tracked~n", [map_size(State)]),
    erlang:send_after(60000, self(), sweep),
    {noreply, State};
handle_info(_Msg, State) ->
    {noreply, State}.

%%% Internal

total(Lines) ->
    Sub = lists:sum([Qty * Price || {_Sku, Qty, Price} <- Lines]),
    round(Sub * (1 + ?TAX_RATE) * 100) / 100.
