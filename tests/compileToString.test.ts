import Compiler from "../src";

test('compiles a simple script', () => {
    const script = `
        return <div>huhu</div>
    `

    const compiler = new Compiler();
    const js = compiler.compileToString(script);
    expect(js.trim()).toBe(`return React.createElement("div", null, "huhu")`);
  });