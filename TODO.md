# TODO 🚧

Your new site is all yours so it doesn't matter if you break it! Try editing the code.

Let's add the wiggle function to other elements in the site–you'll see comments in the code with `TODO` in them for each step.

In `pages/about.jsx`, add the imports at the top:

```js
import { useWiggle } from "../hooks/wiggle";
import { animated } from "react-spring";
```

Bring the wiggle style and trigger function in before the `return` statement, this time with slightly different parameters:

```js
const [style, trigger] = useWiggle({ x: 50, rotation: 1, scale: 1.2 });
```

Replace the header element to use `animated` and apply the wiggle style:

```js
<animated.h1 className="title" style={style}>
 About this site
</animated.h1>
```

Let's make the effect happen when the user hovers over the first paragraph element by replacing its opening tag:

```js
<p onMouseEnter={trigger}>
```

Hover over the paragraph to see the effect on the About page header!

## Keep going! 🚀

Try experimenting with the `useWiggle` properties for different effects!
