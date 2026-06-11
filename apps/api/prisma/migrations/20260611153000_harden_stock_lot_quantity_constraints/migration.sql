DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "StockLot"
        WHERE "remainingQuantity" > "initialQuantity"
    ) THEN
        RAISE EXCEPTION 'Cannot add StockLot remaining <= initial check: invalid existing stock lots found';
    END IF;
END $$;

ALTER TABLE "StockLot"
ADD CONSTRAINT "StockLot_remaining_lte_initial_check"
CHECK ("remainingQuantity" <= "initialQuantity");
