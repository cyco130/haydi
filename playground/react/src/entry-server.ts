import { createRouter } from "@hattip/router";
import React from "react";
import { renderToString } from "react-dom/server";
import { App } from "./App.tsx";

const router = createRouter();

router.get("/", (_ctx) => {
  const app = renderToString(React.createElement(App));
  const html = HTML.replace("%%%APP%%%", app);

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
});

const HTML = `<!DOCTYPE html>
<html>
	<head>
		<meta charset="utf-8">
		<title>Hello world!</title>
	</head>
	<body>
		<div id="app">%%%APP%%%</div>
		<script type="module" src="/entry-client.tsx"></script>
	</body>
</html>
`;

export const requestHandler = router.buildHandler();
