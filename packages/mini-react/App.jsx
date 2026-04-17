/** @jsx React.createElement */
import React from "./core/react.js";

function Demo() {
  const [cnt, setCnt] = React.useState(1);
  const [cnt2, setCnt2] = React.useState(2);
  const [cnt3, setCnt3] = React.useState(3);

  const handleClick = () => {
    setCnt(cnt + 1);
  };

  const handleClick2 = () => {
    setCnt2((cnt2) => cnt2 + 1);
  };

  const handleClick3 = () => {
    setCnt3((cnt3) => cnt3);
  };

  React.useEffect(() => {
    console.log("onMounted");
    return () => {
      console.log("Cleanup");
    };
  }, []);

  React.useEffect(() => {
    console.log(`cnt: ${cnt}`);
    return () => {
      console.log("cnt Cleanup");
    };
  }, [cnt]);

  React.useEffect(() => {
    console.log(`cnt2: ${cnt2}`);
    return () => {
      console.log("cnt2 Cleanup");
    };
  }, [cnt2]);

  React.useEffect(() => {
    console.log(`cnt3: ${cnt3}`);
    return () => {
      console.log("cnt3 Cleanup");
    };
  }, [cnt3]);

  return (
    <div>
      <div>cnt: {cnt}</div>
      <button onClick={handleClick}>addCnt</button>

      <div>cnt2: {cnt2}</div>
      <button onClick={handleClick2}>addCnt2</button>

      <div>cnt3: {cnt3}</div>
      <button onClick={handleClick3}>addCnt3</button>
    </div>
  );
}

export default function App() {
  return (
    <div id="app">
      <Demo />
    </div>
  );
}
