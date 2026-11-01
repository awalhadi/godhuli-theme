-- Godhuli Shop billing package (Oracle 19c)
CREATE OR REPLACE PACKAGE billing_pkg AS
    c_tax_rate CONSTANT NUMBER(5, 4) := 0.0750;
    e_invoice_locked EXCEPTION;
    PRAGMA EXCEPTION_INIT(e_invoice_locked, -54);

    PROCEDURE close_month(p_period IN VARCHAR2, p_dry_run IN BOOLEAN DEFAULT FALSE);
    FUNCTION  invoice_total(p_order_id IN orders.id%TYPE) RETURN NUMBER;
END billing_pkg;
/

CREATE OR REPLACE PACKAGE BODY billing_pkg AS

    FUNCTION invoice_total(p_order_id IN orders.id%TYPE) RETURN NUMBER IS
        v_subtotal NUMBER(12, 2) := 0;
    BEGIN
        SELECT NVL(SUM(li.qty * li.unit_price), 0)
          INTO v_subtotal
          FROM line_items li
         WHERE li.order_id = p_order_id;

        RETURN ROUND(v_subtotal * (1 + c_tax_rate), 2);
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RETURN 0;
    END invoice_total;

    PROCEDURE close_month(p_period IN VARCHAR2, p_dry_run IN BOOLEAN DEFAULT FALSE) IS
        CURSOR c_open_orders (cp_period VARCHAR2) IS
            SELECT o.id, o.customer_id, o.created_at
              FROM orders o
             WHERE TO_CHAR(o.created_at, 'YYYY-MM') = cp_period
               AND o.status = 'PAID'
               FOR UPDATE NOWAIT;

        TYPE t_id_tab IS TABLE OF orders.id%TYPE INDEX BY PLS_INTEGER;
        v_ids     t_id_tab;
        v_total   NUMBER := 0;
        v_count   PLS_INTEGER := 0;
    BEGIN
        DBMS_OUTPUT.PUT_LINE('Closing period ' || p_period || ' ...');

        FOR r IN c_open_orders(p_period) LOOP
            v_count := v_count + 1;
            v_ids(v_count) := r.id;
            v_total := v_total + invoice_total(r.id);
        END LOOP;

        IF v_count = 0 THEN
            RAISE_APPLICATION_ERROR(-20001, 'No paid orders in ' || p_period);
        ELSIF NOT p_dry_run THEN
            FORALL i IN 1 .. v_ids.COUNT
                UPDATE orders SET status = 'INVOICED' WHERE id = v_ids(i);
            COMMIT;
        END IF;

        DBMS_OUTPUT.PUT_LINE(
            'Invoiced ' || v_count || ' orders, total = ' ||
            TO_CHAR(v_total, 'FM999G999G990D00'));
    EXCEPTION
        WHEN e_invoice_locked THEN
            DBMS_OUTPUT.PUT_LINE('Rows locked by another session; retry later.');
            ROLLBACK;
        WHEN OTHERS THEN
            DBMS_OUTPUT.PUT_LINE('Error: ' || SQLERRM);
            ROLLBACK;
            RAISE;
    END close_month;

END billing_pkg;
/
