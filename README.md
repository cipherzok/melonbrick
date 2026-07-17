# melonbrick

## How to use

Download the latest release from https://github.com/cipherzok/melonbrick/releases.

That is some kind of launcher. Open it every time you want to play.

The first time you run it, it will automatically install everything in the current folder.

## How to install mods

Simply drag the mod folder (not a `.zip` or `.rar` file) into `./mods`.

```text
┌── assets/
├── lib/
├── mods/
│   └── my-mod/
│       └── main.js
├── favicon.png
├── index.html
├── Mine Blocks.js
├── melonbrick
└── mods.json
```

## API

### `melonbrick.waitReference(name, callback)`

Runs the callback when the class or enum becomes available.

```js
melonbrick.waitReference("entities.Entity_Lightning", () => {
    console.log(melonbrick.scope.entities.Entity_Lightning.randomizeLightningPosition);
});
```

### `melonbrick.waitConstructor(name, callback)`

Runs the callback before the constructor is assigned.

```js
melonbrick.waitConstructor("World", () => {
    const old = melonbrick.constructors.World;

    melonbrick.constructors.World = function (...args) {
        console.log(this);
        old.apply(this, args);
    };
});
```

### `melonbrick.listenRoots(callback)`

Runs the callback whenever a root is defined.

```js
let lime;

melonbrick.listenRoots(root => {
    if (root === "lime") {
        lime = melonbrick.scope.lime;
    }
});
```