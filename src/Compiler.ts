// @ts-nocheck

import React from "react"

const tokenTypes = {
  js: 0,
  e_start: 1,
  e_end: 2,
  e_prop: 3,
  e_value: 4,
  e_child_text: 5,
  e_child_js: 6,
  e_child_whitespace: 7,
  e_child_js_start: 8,
  e_child_js_end: 9,
}

const astTypes= {
  program: 0,
  js: 1,
  createElement: 2,
}

// Convert enum props to strings so they can be viewed easily from DevTools
const enums= [tokenTypes, astTypes]


export default class Compiler {
  constructor(options = {}) {
    this.pragma = "React.createElement";
    this.pragmaFrag = "React.Fragment";
    this.maxRecursiveCalls = 1000;
    this.addUseStrict = false;
    this.options = options;
  };

  /**
   * Compile JSX string to JSX component
   *
   * @param {ctx} any An object whose attributes will be available in the component
   * @param {string} input the component source
   * @return {JSXElement} the component
   */
  compileToComponent(ctx, input) {
    const body = this.compileToString(input);
    const func = Function(...Object.keys(ctx), "React", "props", body);
    return (props: any) => func(...Object.values(ctx), React, props);
  }

  /**
   * Compile JSX string to JS string
   *
   * @param {string} input
   * @return {string}
   */
  compileToString(input) {
    // If code appears to be minimized return it without attempting to parse it.
    if (this.isMinimized(input)) {
      return input;
    }

    // Compiler Step 1 - Remove Comments from the Code
    var newInput = this.removeComments(input);

    // Compiler Step 2 (Lexical Analysis) - Convert JSX Code to an array of tokens
    var tokens = this.tokenizer(newInput, this);
    if (this.options.logCompileDetails) {
      console.log(tokens);
    }

    // Compiler Step 3 (Syntactic Analysis) - Convert Tokens to an Abstract Syntax Tree (AST)
    var ast = this.parser(tokens, input);
    if (this.options.logCompileDetails) {
      console.log(ast);
    }

    // Compiler Step 4 (Code Generation) - Convert AST to Code
    var output = this.codeGenerator(ast, input);
    return output;
  }

  /**
   * Helper function to return line/column numbers when an error occurs
   *
   * @param {string} input
   * @param {int} pos
   * @return {string}
   */
  getTextPosition(input, pos) {
    var lines = input.substring(0, pos).split("\n");
    var lineCount = lines.length;
    var line = lines[lineCount - 1];
    return (
      " at Line #: " +
      lineCount +
      ", Column #: " +
      (line.length - 1) +
      ", Line: " +
      line.trim()
    );
  }

  /**
   * Check if the contents of a script appear to be minimized. If so it's likely JavaScript
   * and should not be processed by the compiler. This function can be overwritten by a calling
   * app if needed in case it has specific logic or comments are embedded in the minimized code.
   *
   * @param {string} input
   * @return {bool}
   */
  isMinimized(input) {
    if (
      input.indexOf("\n") === -1 &&
      (input.indexOf("if(") !== -1 || input.indexOf("}render(){return") !== -1)
    ) {
      return true;
    }
    return false;
  }

  /**
   * Helper function that gets called when a '<' character is
   * found to determine if it's likely an element or not.
   *
   * @param {string} input
   * @param {number} current
   * @param {number} length
   * @returns {bool}
   */
  isExpression(input, current, length) {
    var pos = current + 2;
    var foundName = false;
    while (pos < length) {
      var nextChar = input[pos];
      pos++;
      if (/[a-zA-Z0-9_/]/.test(nextChar)) {
        if (foundName) {
          break;
        } else {
          continue;
        }
      } else if (nextChar === ">") {
        break;
      } else if (nextChar === " ") {
        foundName = true;
        continue;
      } else if (
        nextChar === ")" ||
        nextChar === "&" ||
        nextChar === "|" ||
        nextChar === "?" ||
        nextChar === ";"
      ) {
        // This happens if an less than expression uses no spaces and the
        // right-hand side value is a variable. Issue #20 on GitHub.
        return true;
      }
    }
    return false;
  }

  /**
   * Compiler Step 1 - Remove Comments from the Code
   *
   * All Code Comments are simply replaced with whitespace. This keeps the
   * original structure of the code and allows for error messages to report on
   * the correct line/column position of the error. Additionally it simplifies
   * lexical analysis because there is no need to tokenize the comments.
   *
   * Note - this function should handle most but may not handle all comments.
   * If new issues parsing are discovered this function needs to be updated to
   * better handle them.
   *
   * @param {string} input
   * @return {string}
   */
  removeComments(input) {
    var length = input.length,
      newInput = new Array(length),
      state = {
        inCommentReact: false,
        inCommentSingleLine: false,
        inCommentMultiLine: false,
        inStringSingleQuote: false,
        inStringDoubleQuote: false,
        inStringMultiLine: false,
        elementCount: 0,
        jsCount: 0,
      },
      current = 0,
      char,
      charNext;

    function peekNext() {
      return current < length - 1 ? input[current + 1] : null;
    }
    function peekNext2() {
      return current < length - 2
        ? input[current + 1] + input[current + 2]
        : null;
    }

    while (current < length) {
      char = input[current];
      if (state.inCommentReact) {
        if (char === "*" && peekNext2() === "/}") {
          newInput[current] = " ";
          newInput[current + 1] = " ";
          current += 2;
          char = " ";
          state.inCommentReact = false;
        } else if (char !== "\n") {
          char = " ";
        }
      } else if (state.inCommentSingleLine) {
        if (char === "\n") {
          state.inCommentSingleLine = false;
        } else {
          char = " ";
        }
      } else if (state.inCommentMultiLine) {
        if (char == "*" && peekNext() === "/") {
          newInput[current] = " ";
          current++;
          char = " ";
          state.inCommentMultiLine = false;
        } else if (char !== "\n") {
          char = " ";
        }
      } else if (state.inStringDoubleQuote) {
        if (char === '"' && input[current - 1] !== "\\") {
          state.inStringDoubleQuote = false;
        }
      } else if (state.inStringSingleQuote) {
        if (char === "'" && input[current - 1] !== "\\") {
          state.inStringSingleQuote = false;
        }
      } else if (state.inStringMultiLine) {
        if (char === "`") {
          state.inStringMultiLine = false;
        }
      } else {
        switch (char) {
          case "{":
            if (peekNext2() === "/*") {
              newInput[current] = " ";
              newInput[current + 1] = " ";
              current += 2;
              char = " ";
              state.inCommentReact = true;
            } else if (state.elementCount > 0) {
              state.jsCount++;
            }
            break;
          case "}":
            if (state.elementCount > 0 && state.jsCount > 0) {
              state.jsCount--;
            }
            break;
          case "/":
            if (state.elementCount === 0 || state.jsCount > 0) {
              var next = peekNext();
              state.inCommentSingleLine = next === "/";
              if (!state.inCommentSingleLine) {
                state.inCommentMultiLine = next === "*";
              }
              if (state.inCommentSingleLine || state.inCommentMultiLine) {
                newInput[current] = " ";
                current++;
                char = " ";
              }
            }
            break;
          case '"':
            state.inStringDoubleQuote = true;
            break;
          case "'":
            state.inStringSingleQuote = true;
            break;
          case "`":
            state.inStringMultiLine = true;
            break;
          case "<":
            charNext = peekNext();
            if (
              /[a-zA-Z>]/.test(charNext) &&
              !this.isExpression(input, current, length)
            ) {
              state.elementCount++;
            } else if (charNext === "/") {
              state.elementCount--;
            }
            break;
          case ">":
            if (input[current - 1] === "/" && state.elementCount > 0) {
              state.elementCount--;
            }
            break;
        }
      }
      newInput[current] = char;
      current++;
    }
    return newInput.join("");
  }

  /**
   * Compiler Step 2 (Lexical Analysis) - Convert JSX Code to an array of tokens.
   *
   * Warning, this function is large, contains recursive private functions, and is
   * built for speed and features over readability. Using breakpoints with DevTools
   * is recommended when making changes and to better understand how the code works.
   *
   * @param {string} input
   * @return {array}
   */
  tokenizer(input, compiler) {
    var length = input.length,
      current = 0,
      tokens = [],
      char,
      pos,
      loopCount = 0,
      callCount = 0,
      nextChar,
      maxRecursiveCalls = this.maxRecursiveCalls;

    // Private function to return the next React/JSX Element
    function nextElementPos() {
      var c = current,
        char,
        state = {
          inStringSingleQuote: false,
          inStringDoubleQuote: false,
          inStringMultiLine: false,
        };

      while (c < length - 1) {
        char = input[c];
        if (state.inStringDoubleQuote) {
          if (char === '"' && input[c - 1] !== "\\") {
            state.inStringDoubleQuote = false;
          }
        } else if (state.inStringSingleQuote) {
          if (char === "'" && input[c - 1] !== "\\") {
            state.inStringSingleQuote = false;
          }
        } else if (state.inStringMultiLine) {
          if (char === "`") {
            state.inStringMultiLine = false;
          }
        } else {
          switch (char) {
            case '"':
              state.inStringDoubleQuote = true;
              break;
            case "'":
              state.inStringSingleQuote = true;
              break;
            case "`":
              state.inStringMultiLine = true;
              break;
            case "<":
              if (
                /[a-zA-Z>]/.test(input[c + 1]) &&
                !compiler.isExpression(input, c, length)
              ) {
                return c; // Start of Element found
              }
              break;
          }
        }
        c++;
      }
      return null;
    }

    // Private functions to return the current or next characters without
    // incrementing the counter for the current position.
    function peekCurrent() {
      return current < length ? input[current] : null;
    }
    function peekNext() {
      return current < length ? input[current + 1] : null;
    }

    // Safety check to prevent endless loops on unexpected errors.
    // The number of loops should always be less that then string length.
    function loopCheck() {
      loopCount++;
      if (loopCount > length) {
        throw new Error("Endless loop encountered in tokenizer");
      }
    }

    function tokenizeElement(startPosition, firstNode) {
      // Safety check
      callCount++;
      if (callCount > maxRecursiveCalls) {
        throw new Error(
          "Call count exceeded in tokenizer. If you have a large JSX file that is valid you can increase them limit using the property `this.maxRecursiveCalls`."
        );
      }

      // Current state of the processed text
      var state = {
        value: input[pos],
        elementStack: 0,
        elementState: [],
        currentElementState: null,
        inElement: true,
        hasElementName: false,
        elementClosed: false,
        closeElement: false,
        closingElement: false,
        fatalError: false,
        errorMessage: null,
        addElementEnd: false,
        breakLoop: false,
        addChild: false,
        addChar: true,
        hasProp: false,
        inValue: false,
        inPropString: false,
        propStringChar: null,
        jsWithElement: false,
      };

      // Add text up to the matched position as JavaScript
      if (current < startPosition && firstNode) {
        tokens.push({
          type: tokenTypes.js,
          value: input.substring(current, startPosition),
          pos: current,
        });
      }

      // Tokenize the current React element. This loop inside the recursive function
      // provides core logic to process characters one at a time. The loop from the main
      // calling function is used to find JSX elements.
      current = startPosition + 1;
      while (current < length) {
        loopCheck();

        // Get the character at the current position in the input string
        char = input[current];

        // Handle character differently depending on if the current
        // position is still inside the <element> `state.inElement`
        // or if it is in a child/code section <element>{code}</element>
        if (state.inElement) {
          if (state.hasElementName) {
            state.value += char;
            current++;
            state.breakLoop = false;
            state.hasProp = false;
            state.inValue = false;
            while (current < length) {
              loopCheck();
              char = input[current];
              current++;
              if (state.inPropString && char !== state.propStringChar) {
                state.value += char;
                continue;
              }
              switch (char) {
                case "=":
                  if (state.currentElementState.inPropJs) {
                    break;
                  }
                  if (state.value.trim() !== "") {
                    tokens.push({
                      type: tokenTypes.e_prop,
                      value: state.value,
                      pos: current,
                    });
                    state.hasProp = true;
                    state.inValue = true;
                  }
                  state.value = "";
                  nextChar = peekCurrent();
                  if (nextChar === '"' || nextChar === "'") {
                    state.inPropString = true;
                    state.propStringChar = nextChar;
                    current++;
                  } else if (nextChar === "{") {
                    state.currentElementState.inPropJs = true;
                    state.currentElementState.jsPropBracketCount = 0;
                    current++;
                  }
                  continue;
                case state.propStringChar:
                  if (state.inPropString) {
                    state.inPropString = false;
                    tokens.push({
                      type: state.hasProp
                        ? tokenTypes.e_value
                        : tokenTypes.e_prop,
                      value: JSON.stringify(state.value),
                      pos: current,
                    });
                    state.inValue = false;
                    state.hasProp = false;
                    state.value = "";
                    continue;
                  }
                  break;
                case "}":
                  if (state.currentElementState.inPropJs) {
                    if (state.currentElementState.jsPropBracketCount === 0) {
                      state.currentElementState.inPropJs = false;
                      if (state.value.trim() !== "") {
                        if (state.jsWithElement) {
                          tokens.push({
                            type: tokenTypes.e_child_js_end,
                            value: state.value,
                            pos: current,
                          });
                          state.jsWithElement = false;
                        } else {
                          if (state.value.trim() !== ">") {
                            tokens.push({
                              type: tokenTypes.e_value,
                              value: state.value,
                              pos: current,
                            });
                            state.hasProp = false;
                          }
                        }
                      }
                      state.inValue = false;
                      state.value = "";
                      continue;
                    } else {
                      state.currentElementState.jsPropBracketCount--;
                    }
                  }
                  break;
                case " ":
                case "\t":
                case "\r":
                case "\n":
                  if (!state.currentElementState.inPropJs) {
                    if (state.value.trim() !== "") {
                      tokens.push({
                        type: state.hasProp
                          ? tokenTypes.e_value
                          : tokenTypes.e_prop,
                        value: state.value,
                        pos: current,
                      });
                    }
                    state.inValue = false;
                    state.value = "";
                  }
                  break;
                case "/":
                  if (peekCurrent() === ">") {
                    current--;
                    state.breakLoop = true;
                    state.hasElementName = false;
                  }
                  break;
                case "<":
                  if (
                    state.currentElementState.inPropJs &&
                    peekCurrent() !== " "
                  ) {
                    if (state.value.trim() !== "") {
                      tokens.push({
                        type: tokenTypes.e_child_js_start,
                        value: state.value,
                        pos: current,
                      });
                      state.value = "";
                      state.jsWithElement = true;
                    }
                    current--;
                    tokenizeElement(current, false);
                    char = "";
                    if (state.jsWithElement) {
                      current++;
                    }
                  }
                  break;
                case "{":
                  if (state.currentElementState.inPropJs) {
                    state.currentElementState.jsPropBracketCount++;
                  }
                  break;
                case ">":
                  if (!state.currentElementState.inPropJs) {
                    state.breakLoop = true;
                    state.hasElementName = false;
                  }
                  break;
              }
              if (state.breakLoop) {
                var trimValue = state.value.trim();
                var lastToken = tokens[tokens.length - 1];
                if (
                  state.value === "/" &&
                  char === ">" &&
                  lastToken.type === tokenTypes.e_start
                ) {
                  tokens.push({
                    type: tokenTypes.e_end,
                    value: state.value + char,
                    pos: current,
                  });
                  if (state.elementStack <= 1) {
                    if (peekCurrent() !== "}") {
                      current--;
                    }
                    return;
                  } else {
                    state.elementStack--;
                    state.elementState.pop();
                    state.currentElementState =
                      state.elementStack === 0
                        ? null
                        : state.elementState[state.elementStack - 1];
                  }
                } else if (
                  char === ">" &&
                  trimValue !== "" &&
                  (/^[a-zA-Z0-9-_]*$/.test(trimValue) ||
                    /{\.\.\.(.+)}/.test(trimValue)) &&
                  (lastToken.type === tokenTypes.e_start ||
                    lastToken.type === tokenTypes.e_value)
                ) {
                  tokens.push({
                    type: tokenTypes.e_prop,
                    value: trimValue,
                    pos: current,
                  });
                } else if (trimValue !== "") {
                  console.log(tokens);
                  throw new Error(
                    "Unhandled character in element properties: `" +
                      state.value +
                      "`" +
                      compiler.getTextPosition(input, current)
                  );
                }
                state.value = "";
                state.breakLoop = false;
                break;
              }
              state.value += char;
            }
          }
          switch (char) {
            case "/":
              if (state.value === "" || state.value === "<") {
                state.closingElement = true;
              } else if (peekCurrent() === ">") {
                state.closeElement = true;
                state.inElement = false;
                state.addElementEnd = true;
              } else if (peekNext() === ">") {
                state.closeElement = true;
                state.hasElementName = true;
                char = "";
                current--;
              } else {
                state.fatalError = true;
                state.errorMessage =
                  'Error found a "/" character in element [' +
                  state.value +
                  '] but not closing "/>"' +
                  compiler.getTextPosition(input, current);
              }
              break;
            case ">":
              state.closeElement = true;
              state.inElement = false;
              break;
            case " ":
            case "\t":
            case "\n":
            case "\r":
              state.hasElementName = true;
              state.closeElement = true;
              break;
          }
        } else {
          switch (char) {
            case "}":
              if (state.currentElementState.inJs) {
                if (state.currentElementState.jsBracketCount === 0) {
                  state.currentElementState.inJs = false;
                  state.currentElementState.closeJs = true;
                  state.addChild = true;
                  state.addChar = false;
                } else {
                  state.currentElementState.jsBracketCount--;
                }
              }
              break;
            case "{":
              if (state.currentElementState.inJs) {
                state.currentElementState.jsBracketCount++;
              } else {
                state.currentElementState.inJs = true;
                state.currentElementState.jsBracketCount = 0;
                state.addChild = true;
                state.addChar = false;
              }
              break;
            case "<":
              if (
                /[a-zA-Z>/]/.test(peekNext()) &&
                !compiler.isExpression(input, current, length)
              ) {
                state.addChild = true;
                state.inElement = true;
              }
              break;
          }
          if (state.addChild) {
            if (state.value.trim() === "") {
              if (state.value !== "") {
                tokens.push({
                  type: tokenTypes.e_child_whitespace,
                  value: state.value,
                  pos: current,
                });
              }
            } else {
              var isJS =
                state.currentElementState.closeJs ||
                (state.currentElementState.inJs &&
                  state.currentElementState.jsBracketCount > 0) ||
                (state.currentElementState.inJs && state.inElement);
              tokens.push({
                type: isJS ? tokenTypes.e_child_js : tokenTypes.e_child_text,
                value: state.value,
                pos: current,
              });
            }
            state.addChild = false;
            state.value = "";
            if (state.currentElementState.closeJs) {
              state.currentElementState.closeJs = false;
              state.currentElementState.inJs = false;
            }
          }
        }

        // Should the current element be closed?
        if (state.closeElement) {
          if (char !== " " && char !== "\t" && char !== "\n" && char !== "\r") {
            state.value += char;
          }
          if (state.closingElement) {
            tokens.push({
              type: tokenTypes.e_end,
              value: state.value,
              pos: current,
            });
            state.hasElementName = false;
            state.elementStack--;
            state.elementState.pop();
            state.currentElementState =
              state.elementStack === 0
                ? null
                : state.elementState[state.elementStack - 1];
            if (state.elementStack === 0) {
              state.elementClosed = true;
            }
          } else {
            if (state.value === ">") {
              current--;
            } else {
              tokens.push({
                type: tokenTypes.e_start,
                value: state.value,
                pos: current,
              });
              state.elementStack++;
              state.currentElementState = {
                inJs: false,
                jsBracketCount: 0,
                closeJs: false,
                inPropJs: false,
                jsPropBracketCount: 0,
              };
              state.elementState.push(state.currentElementState);
            }
          }
          state.value = "";
          state.closeElement = false;
          state.closingElement = false;
          if (state.addElementEnd) {
            tokens.push({
              type: tokenTypes.e_end,
              value: state.value,
              pos: null,
            });
            state.addElementEnd = false;
          }
        } else {
          if (state.addChar) {
            state.value += char;
          }
          state.addChar = true;
        }

        // Exit nested element loop once the element has been closed
        if (state.elementClosed) {
          break;
        }

        // Next character
        current++;
      } // End of `while (current < length)` loop in the recursive `tokenizeElement()` function

      // Was there a fatal error in the loop?
      if (state.fatalError) {
        console.log(tokens);
        throw new Error(state.errorMessage);
      }
    }

    // Main loop to find and process JSX elements inside of plain JS
    while (current < length) {
      loopCheck();

      // Find the next React Element and add remaining js once all elements are found
      pos = nextElementPos();
      if (pos === null) {
        tokens.push({
          type: tokenTypes.js,
          value: input.substring(current, length),
          pos: current,
        });
        break;
      }

      tokenizeElement(pos, true);
      current++;
    }
    return tokens;
  }

  /**
   * Compiler Step 3 (Syntactic Analysis) - Convert Tokens to an Abstract Syntax Tree (AST)
   *
   * @param {array} tokens
   * @param {string} input Original input is passed to allow for helpful error messages
   * @return {object}
   */
  parser(tokens, input) {
    var current = 0,
      ast = {
        type: astTypes.program,
        body: [],
        pos: null,
      },
      callCount = 0,
      tokenCount = tokens.length,
      maxRecursiveCalls = this.maxRecursiveCalls,
      pragmaFrag = this.pragmaFrag,
      e_start_count = 0,
      e_end_count = 0;

    // Default to use `React.Fragment`, however if a code hint for
    // Babel is found such as `// @jsxFrag Vue.Fragment` then use
    // the `Fragment` component from the code hint.
    var regex = /(\/\/|\/\*|\/\*\*)\s+@jsxFrag\s+([a-zA-Z.]+)/gm;
    var match = regex.exec(input);
    if (match) {
      pragmaFrag = match[2];
    }

    function nextTokenType() {
      if (current < tokenCount) {
        return tokens[current].type;
      }
      return null;
    }

    function walk(stackCount, startingToken) {
      callCount++;
      if (callCount > maxRecursiveCalls) {
        throw new Error(
          "Call count exceeded in parser. If you have a large JSX file that is valid you can increase them limit using the property `this.maxRecursiveCalls`."
        );
      }

      var token = tokens[current];
      current++;

      if (token.type === tokenTypes.js) {
        return {
          type: astTypes.js,
          value: token.value,
          pos: token.pos,
          stackCount: stackCount,
        };
      }

      if (token.type === tokenTypes.e_start) {
        e_start_count++;
        var elName = token.value
          .replace("<", "")
          .replace("/", "")
          .replace(">", "");
        if (elName === "") {
          elName = pragmaFrag;
        }
        var firstChar = elName[0];
        var node = {
          type: astTypes.createElement,
          name: elName,
          isClass:
            (firstChar >= "A" && firstChar <= "Z") ||
            elName.indexOf(".") !== -1,
          props: [],
          children: [],
          pos: token.pos,
          stackCount: stackCount,
        };

        var breakLoop = false;
        var value;
        while (current < tokenCount) {
          token = tokens[current];
          current++;
          switch (token.type) {
            case tokenTypes.e_prop:
              var prop = {
                name: token.value,
                value: null,
                pos: token.pos,
              };
              var nextNodeType = nextTokenType();
              switch (nextNodeType) {
                case tokenTypes.e_value:
                case tokenTypes.js:
                  prop.value = tokens[current].value;
                  current++;
                  break;
                case tokenTypes.e_start:
                  prop.value = walk(stackCount + 1);
                  break;
                case tokenTypes.e_child_js_start:
                  prop.value = walk(
                    stackCount + 1,
                    tokenTypes.e_child_js_start
                  );
                  break;
              }
              if (prop.name.trim() !== "") {
                node.props.push(prop);
              }
              break;
            case tokenTypes.e_child_js:
              if (token.value.trim() !== "") {
                value = token.value.trim();
                if (value.indexOf("{") === 0) {
                  value = value.substring(1);
                }
                if (value.substring(value.length - 1, value.length) === "}") {
                  value = value.substring(0, value.length - 1);
                }
                node.children.push({
                  type: token.type,
                  value: value,
                  pos: token.pos,
                });
              }
              break;
            case tokenTypes.e_child_js_start:
            case tokenTypes.e_child_js_end:
              node.children.push({
                type: token.type,
                value: value,
                pos: token.pos,
              });
              break;
            case tokenTypes.e_child_text:
              if (token.value.trim() !== "") {
                node.children.push({
                  type: token.type,
                  value: token.value,
                  pos: token.pos,
                });
              }
              break;
            case tokenTypes.e_child_whitespace:
              node.children.push({
                type: token.type,
                value: token.value,
                pos: token.pos,
              });
              break;
            case tokenTypes.e_end:
              var endName = token.value
                .replace("<", "")
                .replace("/", "")
                .replace(">", "");
              if (endName !== node.name && endName !== "") {
                throw new Error(
                  "Found closing element [" +
                    endName +
                    "] that does not match opening element [" +
                    node.name +
                    "] from Token # " +
                    token.index +
                    compiler.getTextPosition(input, token.pos)
                );
              }
              breakLoop = true;
              e_end_count++;
              break;
            case tokenTypes.e_start:
              // Handle nested elements here with a recursive call to walk()
              current--;
              node.children.push({
                type: tokenTypes.e_start,
                value: walk(stackCount + 1),
                pos: token.pos,
              });
              break;
            default:
              console.log(tokens);
              console.log(ast);
              throw new Error(
                "Tokens are out of order 1: [" +
                  token.type +
                  "], Token #: " +
                  token.index +
                  compiler.getTextPosition(input, token.pos)
              );
          }
          if (breakLoop) {
            break;
          }
        }
        return node;
      } else if (
        token.type === tokenTypes.e_child_js_start &&
        token.type === startingToken
      ) {
        var nodes = [token];
        while (current < tokenCount) {
          token = tokens[current];
          current++;
          switch (token.type) {
            case tokenTypes.e_start:
              current--;
              nodes.push(walk(stackCount + 1));
              break;
            case tokenTypes.e_child_js_end:
              nodes.push(token);
              return nodes;
            default:
              throw new Error(
                "Found unexpected token type in JS child prop: [" +
                  token.type +
                  "], Token #: " +
                  token.index +
                  compiler.getTextPosition(input, token.pos)
              );
          }
        }
      }

      throw new Error(
        "Tokens are out of order 2: [" +
          token.type +
          "], Token #: " +
          token.index +
          compiler.getTextPosition(input, token.pos)
      );
    } // walk()

    for (var n = 0; n < tokenCount; n++) {
      tokens[n].index = n;
    }

    while (current < tokenCount) {
      ast.body.push(walk(0));
    }

    // Checking opening and closing tag count.
    // Because jsxLoader is a minimal JSX compiler and not a full JS compiler
    // it is unable to determine the error location in code for this type of error.
    // To avoid this develop using a IDE such as VS Code that highlights errors in code.
    if (e_start_count !== e_end_count) {
      throw new Error(
        'The number of opening elements (for example: "<div>") does not match the number closing elements ("</div>").'
      );
    }
    return ast;
  }

  /**
   * Compiler Step 4 (Code Generation) - Convert AST to Code.
   *
   * Often compilers will include additional steps in-between the original AST
   * and Code Generation such as converting to a different AST format or optimizing.
   * For example the [The Super Tiny Compiler] which this script used as a starting
   * point includes extra functions `traverser()` and `transformer()`. This function
   * combines the steps because most AST nodes are kept (only some whitespace is
   * dropped and the logic is relatively simple). By combining transformation and
   * code generation only a single iteration is needed over the original AST is
   * performed and only one copy of the AST is made.
   *
   * @param {object} ast
   * @param {string} input
   * @return {string}
   */
  codeGenerator(ast, input) {
    var addUseStrict = this.addUseStrict;

    // Default to use `React.createElement`, however if a code hint for
    // Babel is found such as `// @jsx preact.createElement` then use
    // the `createElement()` function from the code hint.
    var createElement = this.pragma;
    var regex = /(\/\/|\/\*|\/\*\*)\s+@jsx\s+([a-zA-Z.]+)/gm;
    var match = regex.exec(input);
    if (match) {
      createElement = match[2];
    }
    return generateCode(ast);

    // Recursive private function for generating code
    function generateCode(node, skipIndent) {
      switch (node.type) {
        case astTypes.program:
          var generatedJs = node.body.map(generateCode).join("");
          // By default if 'use strict' is not found then add it to the start of the generated code.
          // This can be turned off by setting `this.addUseStrict = false`;
          if (
            addUseStrict &&
            generatedJs.indexOf('"use strict"') === -1 &&
            generatedJs.indexOf("'use strict'") === -1
          ) {
            return '"use strict";\n' + generatedJs;
          }
          return generatedJs;
        case astTypes.js:
        case tokenTypes.e_child_js_start:
        case tokenTypes.e_child_js_end:
          return node.value;
        case astTypes.createElement:
          // Start of Element
          var js =
            createElement +
            "(" +
            (node.isClass ? node.name : JSON.stringify(node.name)) +
            ", ";
          if (node.stackCount > 0) {
            if (skipIndent !== true) {
              js = "\n" + " ".repeat(8) + " ".repeat(node.stackCount * 4) + js;
            } else {
              js = " " + js;
            }
          }
          // Add Element Props
          var propCount = node.props.length;
          var propName;
          var propJs = [];
          if (propCount === 0) {
            js += "null";
          } else {
            js += "{";
            for (var n = 0; n < propCount; n++) {
              var propValue = node.props[n].value;
              if (propValue === null) {
                propValue = "true";
              } else if (typeof propValue !== "string") {
                if (
                  Array.isArray(propValue) &&
                  propValue.length > 0 &&
                  propValue[0].type === tokenTypes.e_child_js_start
                ) {
                  var value2 = "";
                  while (propValue.length > 0) {
                    value2 += generateCode(propValue.shift(), true);
                  }
                  propValue = value2;
                } else {
                  propValue = generateCode(propValue, true);
                }
              }
              propName = node.props[n].name.trim();
              if (propName.indexOf("-") !== -1) {
                propName = JSON.stringify(propName);
              }
              if (propValue === "true" && /{\.\.\.(.+)}/.test(propName)) {
                // Handle spread operators: `{...props}`
                propJs.push(
                  propName.substring(0, propName.length - 1).substring(1) +
                    (n === propCount - 1 ? "" : ", ")
                );
              } else {
                propJs.push(
                  propName +
                    ": " +
                    propValue +
                    (n === propCount - 1 ? "" : ", ")
                );
              }
            }
            var propTextLen = propJs.reduce(function (total, item) {
              return (total += item.length);
            }, 0);
            if (propTextLen > 80) {
              var propIndent = "\n";
              if (skipIndent !== true) {
                propIndent += " ".repeat(12) + " ".repeat(node.stackCount * 4);
              }
              js += propIndent + propJs.join(propIndent);
            } else {
              js += propJs.join("");
            }
            js += "}";
          }
          // Add Element Children
          var childJs = [];
          var hasChildText = false;
          var hasChildJs = false;
          var hasChildEl = false;
          var startsWithJs = false;
          var childCount = node.children.length;
          var lastIndex = null;
          var childElCount = 0;
          var lastElAddedAsJs = false;
          var nodeValue;
          var allChildJsContainsExpressions = true;
          var m;
          // First see what types of child nodes exist
          for (m = 0; m < childCount; m++) {
            switch (node.children[m].type) {
              case tokenTypes.e_child_js:
              case tokenTypes.e_child_js_start:
                hasChildJs = true;
                nodeValue = node.children[m].value;
                // This is not an exact match based on JS syntax but rather
                // a quick check that will work for most JSX code.
                if (
                  typeof nodeValue === "string" &&
                  nodeValue.indexOf("(") === -1 &&
                  nodeValue.indexOf(")") === -1
                ) {
                  allChildJsContainsExpressions = false;
                }
                break;
              case tokenTypes.e_child_text:
                hasChildText = true;
                break;
              case tokenTypes.e_start:
                hasChildEl = true;
                childElCount++;
                break;
              case tokenTypes.e_child_whitespace:
              case tokenTypes.e_child_js_end:
                break; // Ignore, no need to count or track
              default:
                throw new Error(
                  "Unhandled child type codeGenerator(): " +
                    node.children[m].type
                );
            }
          }
          for (m = 0; m < childCount; m++) {
            switch (node.children[m].type) {
              case tokenTypes.e_child_js:
              case tokenTypes.e_child_js_start:
                if (lastElAddedAsJs) {
                  childJs[childJs.length - 1] += node.children[m].value;
                } else {
                  childJs.push(node.children[m].value);
                  if (!startsWithJs && childJs.length === 1) {
                    startsWithJs = true;
                  }
                }
                break;
              case tokenTypes.e_child_text:
                nodeValue = node.children[m].value;
                if (nodeValue.indexOf("&") !== -1) {
                  // Use the browser DOM to convert from HTML to Text if the node might contain
                  // HTML encoded characters. Example: [&amp;] or [&#039;]
                  var tmp = document.createElement("div");
                  tmp.innerHTML = nodeValue;
                  nodeValue = tmp.textContent;
                }
                if (childCount === 1) {
                  childJs.push(JSON.stringify(nodeValue));
                } else if (m === childCount - 1) {
                  childJs.push(JSON.stringify(nodeValue.replace(/\s+$/, ""))); // trimEnd();
                } else if (m === 0) {
                  childJs.push(JSON.stringify(nodeValue.replace(/^\s+/, ""))); // trimStart()
                } else {
                  childJs.push(JSON.stringify(nodeValue));
                }
                break;
              case tokenTypes.e_child_js_end:
                childJs.push(node.children[m].value);
                break;
              case tokenTypes.e_start:
                var skipElIndent = false;
                var addedAsJs = false;
                if (lastIndex !== null) {
                  skipElIndent =
                    node.children[lastIndex].type === tokenTypes.e_child_js;
                }
                if (skipElIndent) {
                  var lastValue = node.children[lastIndex].value.trim();
                  if (
                    lastValue.endsWith("&&") ||
                    lastValue.endsWith("?") ||
                    lastValue.endsWith("(") ||
                    lastValue.endsWith(":") ||
                    lastValue.endsWith(" return")
                  ) {
                    childJs[childJs.length - 1] += generateCode(
                      node.children[m].value,
                      skipElIndent
                    );
                    addedAsJs = true;
                    childElCount--;
                    lastElAddedAsJs = true;
                  }
                }
                if (!addedAsJs) {
                  childJs.push(
                    generateCode(node.children[m].value, skipElIndent)
                  );
                  lastElAddedAsJs = false;
                }
                break;
              case tokenTypes.e_child_whitespace:
                if (
                  (hasChildJs || hasChildText) &&
                  !(m === 0 || m === childCount - 1)
                ) {
                  childJs.push(JSON.stringify(node.children[m].value));
                  lastElAddedAsJs = false;
                }
                continue;
              default:
                throw new Error(
                  "Unhandled child type codeGenerator(): " +
                    node.children[m].type
                );
            }
            lastIndex = m; // Skipped when [e_child_whitespace]
          }
          if (childJs.length > 0) {
            if (
              !hasChildText &&
              hasChildJs &&
              hasChildEl &&
              startsWithJs &&
              childElCount === 1 &&
              allChildJsContainsExpressions
            ) {
              js += ", " + childJs.join("");
            } else {
              js += ", " + childJs.join(", ");
            }
          }
          js += ")";
          return js;
        default:
          throw new TypeError(
            "Unhandled AST type in codeGenerator: " + node.type
          );
      }
    }
  }
};
