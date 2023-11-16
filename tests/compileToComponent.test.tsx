import React from "react";
import { render, screen } from "@testing-library/react";

import Compiler from "../src";

test("compiles a simple script", () => {
  const script = `
        return <div role="div">{b}</div>
    `;
  const ctx = {
    a: 1,
    b: "hihi",
  };

  const compiler = new Compiler();
  const Component = compiler.compileToComponent(ctx, script);

  render(<Component />);
  expect(screen.getByRole("div").textContent).toMatch("hihi");
});
