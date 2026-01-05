import { Agent } from "@atproto/api";
import { BrowserOAuthClient, type ClientMetadata } from "@atproto/oauth-client-browser";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "react-hot-toast";
import { App, Layout } from "./App.tsx";
import "./index.css";

const client = await BrowserOAuthClient.load({clientId:"https://bsky-post-cleaner.tomo-x.win/client-metadata.json",handleResolver:"https://public.api.bsky.app/"})
const res = await client.init().catch((e) => {
	console.error(e);
	window.alert("初期化に失敗しました");
});
let agent: Agent | null;
let handle: string | undefined;
if (res?.session) {
	agent = new Agent(res.session);
	handle = await agent
		.getProfile({ actor: agent.assertDid })
		.then((r) => r.data.handle)
		.catch((e) => {
			console.error(e);
			window.alert("プロフィールの取得に失敗しました");
			agent = null;
			return undefined;
		});
} else {
	agent = null;
}

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<Layout>
			<App client={client} agent={agent} handle={handle} />
			<Toaster position="top-right" />
		</Layout>
	</StrictMode>,
);
