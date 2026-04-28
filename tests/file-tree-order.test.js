import { describe, expect, test } from "bun:test";
import { orderFileTreePaths } from "../src/lib/file-tree-order";

describe("file tree ordering", () => {
    test("orders shortcut navigation paths like the rendered file tree", () => {
        const paths = [
            "services/inventory_processor/src/inventory_processor/helper/repricer/repricer_math_helper.py",
            "services/inventory_processor/src/inventory_processor/service/repricer/end_prices_calculator.py",
            "services/inventory_processor/src/inventory_processor/service/repricer/rule_utility/rule_applier/smily_discount_rule_applier.py",
            "services/inventory_processor/src/inventory_processor/service/repricer/rule_utility/rule_validator/smily_discount_rule_validator.py",
        ];

        expect(orderFileTreePaths(paths)).toEqual([
            "services/inventory_processor/src/inventory_processor/helper/repricer/repricer_math_helper.py",
            "services/inventory_processor/src/inventory_processor/service/repricer/rule_utility/rule_applier/smily_discount_rule_applier.py",
            "services/inventory_processor/src/inventory_processor/service/repricer/rule_utility/rule_validator/smily_discount_rule_validator.py",
            "services/inventory_processor/src/inventory_processor/service/repricer/end_prices_calculator.py",
        ]);
    });

    test("keeps a pinned path first", () => {
        expect(orderFileTreePaths(["src/b.ts", "Summary", "src/a.ts"], "Summary")).toEqual(["Summary", "src/a.ts", "src/b.ts"]);
    });
});
