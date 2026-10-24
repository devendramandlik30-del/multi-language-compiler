
import { useState, useEffect, useRef, useCallback } from "react";
import Editor from "@monaco-editor/react";
import {
  Play,
  RotateCcw,
  Download,
  Code2,
  Terminal,
  ChevronDown,
  LoaderCircle,
  CheckCircle2,
  AlertCircle,
  Clock3,
  Cpu,
  Keyboard,
  Plus,
  Trash2,
  ListChecks,
} from "lucide-react";
import "./index.css";

const JUDGE0_URL = "https://ce.judge0.com";

const languages = {
  python: {
    label: "Python",
    id: 71,
    editor: "python",
    file: "main.py",
    code: 'name = input()\nprint(f"Hello, {name}!")\n',
  },
  java: {
    label: "Java",
    id: 62,
    editor: "java",
    file: "Main.java",
    code: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String name = sc.nextLine();
        System.out.println("Hello, " + name + "!");
        sc.close();
    }
}`,
  },
  c: {
    label: "C",
    id: 50,
    editor: "c",
    file: "main.c",
    code: `#include <stdio.h>
#include <string.h>

int main(void) {
    char name[100];

    if (fgets(name, sizeof(name), stdin) != NULL) {
        name[strcspn(name, "\\n")] = '\\0';
        printf("Hello, %s!\\n", name);
    }

    return 0;
}`,
  },
  cpp: {
    label: "C++",
    id: 54,
    editor: "cpp",
    file: "main.cpp",
    code: `#include <iostream>
#include <string>
using namespace std;

int main() {
    string name;
    getline(cin, name);
    cout << "Hello, " << name << "!" << endl;
    return 0;
}`,
  },
};

const createTestCase = (id) => ({
  id,
  name: `Test Case ${id}`,
  input: "Devendra",
  expectedOutput: "Hello, Devendra!",
  status: "Ready",
  actualOutput: "",
});

function normalizeOutput(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
}

function getErrorMessage(error) {
  if (error instanceof TypeError) {
    return "Network request failed. Check your internet connection. The public Judge0 service may also be unavailable or block browser requests (CORS).";
  }

  return error?.message || "An unexpected error occurred.";
}

export default function App() {
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(languages.python.code);
  const [input, setInput] = useState("Devendra");
  const [output, setOutput] = useState(
    "Your program output will appear here."
  );
  const [status, setStatus] = useState("Ready");
  const [running, setRunning] = useState(false);
  const [executionTime, setExecutionTime] = useState(null);
  const [memory, setMemory] = useState(null);

  const [testCases, setTestCases] = useState([
    createTestCase(1),
  ]);
  const [activeTestId, setActiveTestId] = useState(1);
  const [nextTestId, setNextTestId] = useState(2);
  const [testSummary, setTestSummary] = useState("");

  const editorRef = useRef(null);

  const executeCode = useCallback(
    async (stdin) => {
      const response = await fetch(
        `${JUDGE0_URL}/submissions?base64_encoded=false&wait=false`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_code: code,
            language_id: languages[language].id,
            stdin,
            cpu_time_limit: 2,
            wall_time_limit: 5,
            memory_limit: 128000,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Judge0 returned HTTP ${response.status}. The service may be busy or unavailable.`
        );
      }

      const submission = await response.json();

      if (!submission.token) {
        throw new Error(
          "Judge0 did not return a submission token."
        );
      }

      let result = null;

      for (let attempt = 0; attempt < 25; attempt++) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1000)
        );

        const resultResponse = await fetch(
          `${JUDGE0_URL}/submissions/${submission.token}?base64_encoded=false`
        );

        if (!resultResponse.ok) {
          throw new Error(
            `Unable to retrieve execution result (HTTP ${resultResponse.status}).`
          );
        }

        result = await resultResponse.json();

        if (result.status?.id > 2) {
          break;
        }
      }

      if (!result || result.status?.id <= 2) {
        return {
          ok: false,
          status: "Still processing",
          output:
            "Judge0 is taking longer than expected. Try running this program again later.",
          time: null,
          memory: null,
        };
      }

      const statusId = result.status?.id;
      const description =
        result.status?.description || "Finished";

      const parts = [];

      if (result.stdout) {
        parts.push(result.stdout);
      }

      if (result.compile_output) {
        parts.push(
          "Compilation Error:\n" + result.compile_output
        );
      }

      if (result.stderr) {
        parts.push(
          (statusId === 3 ? "Standard Error:" : "Runtime Error:") +
            "\n" +
            result.stderr
        );
      }

      if (result.message) {
        parts.push("Message:\n" + result.message);
      }

      if (statusId === 5) {
        parts.push(
          "Execution stopped because the time limit was exceeded."
        );
      }

      if (statusId === 6 && !result.compile_output) {
        parts.push("The compiler could not compile this program.");
      }

      const outputText =
        parts.join("\n\n") ||
        (statusId === 3
          ? "Program finished successfully with no output."
          : `Program finished with status: ${description}.`);

      return {
        ok: statusId === 3,
        status: description,
        output: outputText,
        stdout: result.stdout || "",
        time: result.time ?? null,
        memory: result.memory ?? null,
      };
    },
    [code, language]
  );

  const runCode = useCallback(async () => {
    if (running) return;

    setRunning(true);
    setStatus("Submitting");
    setOutput("Submitting code to Judge0...");
    setExecutionTime(null);
    setMemory(null);

    try {
      const result = await executeCode(input);

      setStatus(result.status);
      setOutput(result.output);
      setExecutionTime(result.time);
      setMemory(result.memory);
    } catch (error) {
      setStatus("Request failed");
      setOutput(getErrorMessage(error));
    } finally {
      setRunning(false);
    }
  }, [running, executeCode, input]);

  const downloadCode = useCallback(() => {
    const blob = new Blob([code], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = languages[language].file;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }, [code, language]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(event) {
      const modifier = event.ctrlKey || event.metaKey;

      if (modifier && event.key === "Enter") {
        event.preventDefault();
        runCode();
      }

      if (modifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        downloadCode();
      }

      if (
        event.shiftKey &&
        event.altKey &&
        event.key.toLowerCase() === "f"
      ) {
        event.preventDefault();

        editorRef.current
          ?.getAction("editor.action.formatDocument")
          ?.run();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [runCode, downloadCode]);

  function changeLanguage(nextLanguage) {
    setLanguage(nextLanguage);
    setCode(languages[nextLanguage].code);
    setOutput("Ready to run your program.");
    setStatus("Ready");
    setExecutionTime(null);
    setMemory(null);
    setTestSummary("");

    setTestCases((previous) =>
      previous.map((test) => ({
        ...test,
        status: "Ready",
        actualOutput: "",
      }))
    );
  }

  function resetCode() {
    setCode(languages[language].code);
    setInput("Devendra");
    setOutput("Your program output will appear here.");
    setStatus("Ready");
    setExecutionTime(null);
    setMemory(null);
    setTestSummary("");

    setTestCases((previous) =>
      previous.map((test) => ({
        ...test,
        status: "Ready",
        actualOutput: "",
      }))
    );
  }

  function addTestCase() {
    const newTest = createTestCase(nextTestId);

    setTestCases((previous) => [...previous, newTest]);
    setActiveTestId(newTest.id);
    setNextTestId((previous) => previous + 1);
    setTestSummary("");
  }

  function deleteTestCase(id) {
    setTestCases((previous) => {
      const remaining = previous.filter(
        (test) => test.id !== id
      );

      if (remaining.length === 0) {
        const replacement = createTestCase(nextTestId);
        setNextTestId((value) => value + 1);
        setActiveTestId(replacement.id);
        return [replacement];
      }

      if (activeTestId === id) {
        setActiveTestId(remaining[0].id);
      }

      return remaining;
    });

    setTestSummary("");
  }

  function updateTestCase(id, field, value) {
    setTestCases((previous) =>
      previous.map((test) =>
        test.id === id
          ? {
              ...test,
              [field]: value,
              status: "Ready",
              actualOutput: "",
            }
          : test
      )
    );

    setTestSummary("");
  }

  async function runAllTests() {
    if (running) return;

    const testsToRun = testCases.map((test) => ({ ...test }));

    setRunning(true);
    setStatus("Running tests");
    setOutput("Running test cases...");
    setExecutionTime(null);
    setMemory(null);
    setTestSummary("");

    setTestCases((previous) =>
      previous.map((test) => ({
        ...test,
        status: "Queued",
        actualOutput: "",
      }))
    );

    let passed = 0;
    let failed = 0;
    let errors = 0;
    let lastResult = null;

    try {
      for (const test of testsToRun) {
        setTestCases((previous) =>
          previous.map((item) =>
            item.id === test.id
              ? { ...item, status: "Running" }
              : item
          )
        );

        try {
          const result = await executeCode(test.input);
          lastResult = result;

          const executionSucceeded = result.ok;
          const matches =
            executionSucceeded &&
            normalizeOutput(result.stdout) ===
              normalizeOutput(test.expectedOutput);

          let testStatus;

          if (!executionSucceeded) {
            testStatus = "ERROR";
            errors++;
          } else if (matches) {
            testStatus = "PASS";
            passed++;
          } else {
            testStatus = "FAIL";
            failed++;
          }

          setTestCases((previous) =>
            previous.map((item) =>
              item.id === test.id
                ? {
                    ...item,
                    status: testStatus,
                    actualOutput: result.stdout || result.output,
                  }
                : item
            )
          );
        } catch (error) {
          errors++;

          setTestCases((previous) =>
            previous.map((item) =>
              item.id === test.id
                ? {
                    ...item,
                    status: "ERROR",
                    actualOutput: getErrorMessage(error),
                  }
                : item
            )
          );
        }
      }

      setTestSummary(
        `${passed} passed · ${failed} failed · ${errors} errors · ${testsToRun.length} total`
      );

      if (lastResult) {
        setOutput(lastResult.output);
        setExecutionTime(lastResult.time);
        setMemory(lastResult.memory);
      }

      setStatus(
        errors > 0
          ? "Tests completed with errors"
          : failed > 0
            ? "Tests failed"
            : "All tests passed"
      );
    } finally {
      setRunning(false);
    }
  }

  const successful = status === "Accepted";

  const activeTest =
    testCases.find((test) => test.id === activeTestId) ||
    testCases[0];

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <Code2 size={22} />
          </div>
          <div>
            <h1>CodeSpace</h1>
            <p>Online Compiler</p>
          </div>
        </div>

        <div className="topbar-right">
          <span className="online-dot" />
          <span className="topbar-label">Multi-language IDE</span>
          <span className="version-pill">v2.0</span>
        </div>
      </header>

      <section className="workspace">
        <div className="welcome-row">
          <div>
            <p className="eyebrow">DEVELOPMENT ENVIRONMENT</p>
            <h2>Write. Run. Learn.</h2>
            <p className="subtitle">
              Write code in your favorite language and run it online.
            </p>
          </div>

          <div className="language-summary">
            <span className="language-summary-icon">
              <Code2 size={17} />
            </span>
            <span>4 languages supported</span>
          </div>
        </div>

        <section className="ide">
          <div className="ide-toolbar">
            <div className="file-tab">
              <span className="file-dot" />
              <span>{languages[language].file}</span>
            </div>

            <div className="toolbar-actions">
              <label className="language-select-wrap">
                <Code2 size={16} />
                <select
                  aria-label="Programming language"
                  value={language}
                  disabled={running}
                  onChange={(event) =>
                    changeLanguage(event.target.value)
                  }
                >
                  {Object.entries(languages).map(([key, item]) => (
                    <option key={key} value={key}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </label>

              <button
                className="icon-button"
                onClick={resetCode}
                title="Reset code"
                aria-label="Reset code"
                disabled={running}
              >
                <RotateCcw size={16} />
              </button>

              <button
                className="icon-button"
                onClick={downloadCode}
                title="Download source code (Ctrl+S)"
                aria-label="Download source code"
              >
                <Download size={16} />
              </button>

              <button
                className="run-button"
                onClick={runCode}
                disabled={running}
                title="Run code (Ctrl+Enter)"
              >
                {running ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Play size={16} fill="currentColor" />
                )}
                {running ? "Running..." : "Run Code"}
              </button>
            </div>
          </div>

          <div className="editor-container">
            <Editor
              height="430px"
              language={languages[language].editor}
              theme="vs-dark"
              value={code}
              onMount={(editor) => {
                editorRef.current = editor;
              }}
              onChange={(value) => setCode(value ?? "")}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                padding: { top: 18 },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                wordWrap: "on",
                tabSize: 4,
                renderLineHighlight: "all",
                smoothScrolling: true,
                cursorBlinking: "smooth",
                bracketPairColorization: { enabled: true },
              }}
            />
          </div>

          <div className="editor-footer">
            <span>{languages[language].label}</span>
            <span>UTF-8</span>
            <span>Spaces: 4</span>
          </div>

          <div className="bottom-panels">
            <section className="panel input-panel">
              <div className="panel-heading">
                <div className="panel-title">
                  <Keyboard size={16} />
                  <h3>Program Input</h3>
                </div>
                <span className="panel-hint">STDIN</span>
              </div>

              <textarea
                value={input}
                disabled={running}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Enter program input here..."
                spellCheck={false}
                aria-label="Program input"
              />

              <p className="input-note">
                Input is passed to input(), Scanner, scanf() or cin.
              </p>
            </section>

            <section className="panel output-panel">
              <div className="panel-heading">
                <div className="panel-title">
                  <Terminal size={16} />
                  <h3>Output</h3>
                </div>

                <span
                  className={`status-pill ${
                    successful ? "status-success" : ""
                  } ${status === "Ready" ? "status-ready" : ""}`}
                >
                  {running ? (
                    <LoaderCircle className="spin" size={12} />
                  ) : successful ? (
                    <CheckCircle2 size={12} />
                  ) : status === "Ready" ? (
                    <Clock3 size={12} />
                  ) : (
                    <AlertCircle size={12} />
                  )}
                  {status}
                </span>
              </div>

              <pre className="output-content">{output}</pre>

              <div className="output-footer">
                <span>
                  <Cpu size={13} />
                  {executionTime !== null
                    ? `${executionTime} s`
                    : "Execution time"}
                </span>
                <span>
                  {memory !== null
                    ? `${memory} KB`
                    : "Memory usage"}
                </span>
              </div>
            </section>
          </div>

          {/* Multiple test cases */}
          <section
            className="panel"
            style={{ marginTop: 18, padding: 16 }}
          >
            <div className="panel-heading">
              <div className="panel-title">
                <ListChecks size={17} />
                <h3>Test Cases</h3>
              </div>

              <span className="panel-hint">
                {testCases.length} test
                {testCases.length === 1 ? "" : "s"}
              </span>
            </div>

            <p className="input-note">
              Add inputs and expected outputs, then run all tests.
              Output comparison ignores leading and trailing whitespace.
            </p>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                margin: "12px 0",
              }}
            >
              {testCases.map((test, index) => (
                <button
                  key={test.id}
                  type="button"
                  disabled={running}
                  onClick={() => setActiveTestId(test.id)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    border:
                      activeTestId === test.id
                        ? "1px solid #6c8cff"
                        : "1px solid #444",
                    background:
                      activeTestId === test.id
                        ? "#273452"
                        : "transparent",
                    color: "inherit",
                    cursor: "pointer",
                  }}
                >
                  Test {index + 1}
                  {test.status !== "Ready" &&
                    ` · ${test.status}`}
                </button>
              ))}

              <button
                type="button"
                disabled={running}
                onClick={addTestCase}
                className="icon-button"
                title="Add test case"
              >
                <Plus size={16} />
              </button>
            </div>

            {activeTest && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 14,
                }}
              >
                <div>
                  <label
                    htmlFor="test-input"
                    style={{
                      display: "block",
                      marginBottom: 8,
                      fontSize: 13,
                    }}
                  >
                    Standard input
                  </label>
                  <textarea
                    id="test-input"
                    value={activeTest.input}
                    disabled={running}
                    onChange={(event) =>
                      updateTestCase(
                        activeTest.id,
                        "input",
                        event.target.value
                      )
                    }
                    rows={4}
                    spellCheck={false}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      resize: "vertical",
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="test-expected"
                    style={{
                      display: "block",
                      marginBottom: 8,
                      fontSize: 13,
                    }}
                  >
                    Expected output
                  </label>
                  <textarea
                    id="test-expected"
                    value={activeTest.expectedOutput}
                    disabled={running}
                    onChange={(event) =>
                      updateTestCase(
                        activeTest.id,
                        "expectedOutput",
                        event.target.value
                      )
                    }
                    rows={4}
                    spellCheck={false}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      resize: "vertical",
                    }}
                  />
                </div>
              </div>
            )}

            {activeTest && activeTest.status !== "Ready" && (
              <div style={{ marginTop: 14 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  {activeTest.status === "PASS" ? (
                    <CheckCircle2 size={16} color="#22c55e" />
                  ) : activeTest.status === "FAIL" ||
                    activeTest.status === "ERROR" ? (
                    <AlertCircle size={16} color="#ef4444" />
                  ) : (
                    <Clock3 size={16} />
                  )}
                  <strong>{activeTest.status}</strong>
                </div>

                <pre
                  className="output-content"
                  style={{
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                  }}
                >
                  {activeTest.actualOutput || "No output"}
                </pre>
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginTop: 16,
              }}
            >
              <button
                type="button"
                className="run-button"
                onClick={runAllTests}
                disabled={running}
              >
                {running ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Play size={16} />
                )}
                Run All Tests
              </button>

              <button
                type="button"
                className="icon-button"
                disabled={running || testCases.length <= 1}
                onClick={() => deleteTestCase(activeTestId)}
                title="Delete selected test case"
              >
                <Trash2 size={16} />
                Delete Test
              </button>
            </div>

            {testSummary && (
              <p
                role="status"
                style={{ marginTop: 14, fontWeight: 600 }}
              >
                {testSummary}
              </p>
            )}
          </section>

          {/* Keyboard shortcut reference */}
          <section
            className="panel"
            style={{ marginTop: 18, padding: 16 }}
          >
            <div className="panel-heading">
              <div className="panel-title">
                <Keyboard size={17} />
                <h3>Keyboard Shortcuts</h3>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
                fontSize: 13,
              }}
            >
              <span>Run code — Ctrl + Enter</span>
              <span>Download code — Ctrl + S</span>
              <span>Format code — Shift + Alt + F</span>
            </div>
          </section>
        </section>

        <footer className="page-footer">
          <span>CodeSpace · Built for learning and practice</span>
          <span>Execution powered by Judge0</span>
        </footer>
      </section>
    </main>
  );
}
