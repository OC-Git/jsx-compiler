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

test("compiles a script and uses component props", () => {
  const script = `
          const a2 = 2*a;
          return <div role="div">{props.b} {a2}</div>
        `;
  const ctx = {
    a: 1,
  };

  const compiler = new Compiler();
  const Component = compiler.compileToComponent(ctx, script);

  render(<Component b="hihi" />);
  expect(screen.getByRole("div").textContent).toMatch("hihi 2");
});

test("compiles a script and uses component props with var", () => {
  const script = `
          const a2 = 2*a;
          return <div role="div">{p.b} {a2}</div>
        `;
  const ctx = {
    a: 1,
  };

  const compiler = new Compiler();
  const Component = compiler.compileToComponent(ctx, script, "p");

  render(<Component b="hihi" />);
  expect(screen.getByRole("div").textContent).toMatch("hihi 2");
});

test("compiles more complex a script", () => {
  const script = `
    return (
        <>
        {list.map(item => (<div key={item} role={"role-"+item}>{item} {p.b}</div>))}
        </>
    )`;
  const ctx = {
    list: ["a", "b", "c"],
  };

  const compiler = new Compiler();
  const Component = compiler.compileToComponent(ctx, script, "p");

  render(<Component b="hihi" />);
  expect(screen.getByRole("role-b").textContent).toMatch("b hihi");
});
