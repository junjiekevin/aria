import { describe, it, expect } from 'vitest';
import { repairJsonHeuristics } from '../../lib/openrouter';

describe('repairJsonHeuristics', () => {
    it('should replace smart quotes with standard quotes', () => {
        const input = '{"name": \u201Ctest\u201D, \u201Ckey\u201D: "value"}';
        const repaired = repairJsonHeuristics(input);
        expect(JSON.parse(repaired)).toEqual({ name: "test", key: "value" });
    });

    it('should remove trailing commas in objects', () => {
        const input = '{"name": "test", "key": "value",}';
        const repaired = repairJsonHeuristics(input);
        expect(JSON.parse(repaired)).toEqual({ name: "test", key: "value" });
    });

    it('should remove trailing commas in arrays', () => {
        const input = '{"list": [1, 2, 3,]}';
        const repaired = repairJsonHeuristics(input);
        expect(JSON.parse(repaired)).toEqual({ list: [1, 2, 3] });
    });

    it('should wrap unquoted keys in double quotes', () => {
        const input = '{name: "test", age: 25}';
        const repaired = repairJsonHeuristics(input);
        expect(JSON.parse(repaired)).toEqual({ name: "test", age: 25 });
    });

    it('should handle complex mixed malformed JSON', () => {
        const input = '{\n  name: \u201CJohn Doe\u201D,\n  tags: ["admin", "user",],\n  active: true\n}';
        const repaired = repairJsonHeuristics(input);
        expect(JSON.parse(repaired)).toEqual({
            name: "John Doe",
            tags: ["admin", "user"],
            active: true
        });
    });
});
