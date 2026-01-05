import type { Agent } from "@atproto/api";
import type { BrowserOAuthClient } from "@atproto/oauth-client-browser";
import { AtUri } from "@atproto/syntax";
import { type PropsWithChildren, useState } from "react";
import { toast } from "react-hot-toast";

export function Layout({ children }: PropsWithChildren) {
	return <div className="max-w-2xl mx-auto p-4">{children}</div>;
}

export function App({
	client,
	agent,
	handle,
}: {
	client: BrowserOAuthClient;
	agent: Agent | null;
	handle: string | undefined;
}) {
	if (agent == null || handle == null) {
		return <Signin client={client} />;
	}
	return <Main agent={agent} handle={handle} />;
}

function Signin({ client }: { client: BrowserOAuthClient }) {
	const [handle, setHandle] = useState("");
	const handleLogin = async () => {
		if (!handle) return;
		try {
			await toast.promise(client.signIn(handle), { loading: "Signing in..." });
		} catch (e) {
			toast.error("Signin failed");
		}
	};
	return (
		<div>
			<input type="text" value={handle} onChange={(e) => setHandle(e.target.value)} />
		</div>
	);
}

function Main({ agent, handle: usrHandle }: { agent: Agent; handle: string | undefined }) {
	const [url, setUrl] = useState("");
	const [loading, setLoading] = useState(false);
	const handleClear = async () => {
		try {
			setLoading(true);
			const parsed = parseUri(url);
			if (parsed == null) return;
			const { id, rkey } = parsed;
			if (id !== usrHandle && id !== agent.assertDid) return void toast.error("自分以外のポストには使えません");

			const post = await agent.app.bsky.feed
				.getPosts({
					uris: [`at://${agent.assertDid}/app.bsky.feed.post/${rkey}`],
				})
				.then((r) => r.data.posts[0]);
			if (post == null) return void toast.error("ポストが見つかりません");

			await agent.com.atproto.repo.putRecord({
				repo: agent.assertDid,
				collection: "app.bsky.feed.post",
				rkey: rkey,
				record: {
					text: "bsky-post-cleanerにより削除中",
					via: "bsky-post-cleaner",
					createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
				},
			});
			await agent.com.atproto.repo.deleteRecord({
				repo: agent.assertDid,
				collection: "app.bsky.feed.post",
				rkey: rkey,
			});
		} catch (e) {
			console.error(e);
			toast.error("エラーが発生しました");
		} finally {
			setLoading(false);
		}
	};
	return <div>Main</div>;
}

function parseUri(uri: string) {
	try {
		const aturi = new AtUri(uri);
		if (aturi.collection !== "app.bsky.feed.post" || aturi.rkey == null)
			return void toast.error("ポストのURIを入力してください");
		return { id: aturi.hostname, rkey: aturi.rkey };
	} catch {}
	if (!URL.canParse(uri)) return void toast.error("無効なURL");
	const parsed = new URL(uri);
	if (parsed.hostname !== "bsky.app") return void toast.error("bsky.appのURLを入力してください");
	const [_profile, handle, _post, rkey] = parsed.pathname.split("/");
	if (_profile !== "profile" || !handle || _post !== "post" || !rkey)
		return void toast.error("ポストのURLを入力してください");
	return { id: handle, rkey };
}
