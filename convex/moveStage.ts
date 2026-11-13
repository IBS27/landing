import { getProfile } from "./lib/cityProfile";
import { viewerQuery } from "./lib/functions";
import type { MoveFacts } from "./lib/moveStage";
import { currentPlace } from "./lib/myPlace";

/**
 * What Landing Home's status spine (#162) reads: the viewer's own current
 * place (its status and dates, nothing else) and their City Profile brief.
 * Private to the viewer; the stage itself is worked out by `stageOf`
 * (`./lib/moveStage.ts`) against today in San Francisco.
 */
export const get = viewerQuery({
  args: {},
  handler: async (ctx): Promise<MoveFacts> => {
    const [place, profile] = await Promise.all([
      currentPlace(ctx, ctx.viewer._id),
      getProfile(ctx, ctx.viewer),
    ]);
    return {
      place: place && {
        status: place.status,
        moveIn: place.moveIn,
        moveOut: place.moveOut ?? null,
      },
      briefDone: profile.briefCompletedAt !== null,
      plannedMoveIn: profile.moveIn?.value ?? null,
    };
  },
});
