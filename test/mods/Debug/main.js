import { lemongine } from "mine-blocks";

melonbrick.waitReference("lemongine.screens.SplashScreen", () => {
    melonbrick.hookAfter(lemongine.screens.SplashScreen.prototype, "run", function (ctx) {
        ctx.return = true;
    });
});

melonbrick.listen("postGameInstance", ({ game }) => {
    window.currentGame = game;
});