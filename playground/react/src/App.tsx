import React from "react";

export function App() {
  const [count, setCount] = React.useState(0);

  return (
    <main>
      <h1>Hello World!</h1>
      <p>
        <button onClick={() => setCount((old) => old + 1)}>
          Clicked: {count}
        </button>
      </p>
    </main>
  );
}
