// AIGC START
import { z } from 'zod';
export const farewellBundleSchema = z.object({
    lines: z.array(z.string().min(2)).min(1),
});
// AIGC END
//# sourceMappingURL=farewell-schema.js.map