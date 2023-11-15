import Compiler from "../src";

test('compiles a simple script', () => {
    const script = `
        return <div>huhu</div>
    `

    const f = Compiler.compile.bind(Compiler);
    const js = f(script);
    expect(js.trim()).toBe(`return React.createElement("div", null, "huhu")`);
  });