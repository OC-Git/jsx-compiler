# jsx-compiler

This work is in very large parts based upon the work of the
[DataFormsJS](https://www.dataformsjs.com/en/)
project and their
[jsx-loader](https://github.com/dataformsjs/dataformsjs/blob/master/docs/jsx-loader.md)!

Here their compiler is merely re-package to be available standalone.

## Installation

Very simple:

```
npm install jsx-compiler
```

## Compile to Component

You can compile a JSX script to a React component:

```
import Compiler from 'jsx-compiler'

const script = `
    return (
        <>
        {list.map(item => (
            <div key={item}>
                {item} {p.b}
            </div>))}
        </>
)`;
const ctx = {
list: ["a", "b", "c"],
};

const compiler = new Compiler();
const Component = compiler.compileToComponent(ctx, script, "p");

return <Component b="hihi" />;
```

This `<Component/>` will behave as expected.

## Compile to String

You can compile a JSX script to JavaScript:

```
import Compiler from 'jsx-compiler'

const script = `
    return <div>huhu</div>
`

const compiler = new Compiler();
return compiler.compileToString(script);
```

Here, `return React.createElement("div", null, "huhu")` will be returned.
