import type { Agent } from "@atproto/api";
import type { BrowserOAuthClient } from "@atproto/oauth-client-browser";
import { AtUri } from "@atproto/syntax";
import { type PropsWithChildren, useState } from "react";
import { toast } from "react-hot-toast";

function Header() {
	return (
		<header className="mb-6">
			<h1 className="text-xl font-bold text-gray-900 mb-2">bsky-post-cleaner</h1>
			<p className="text-sm text-gray-600 leading-relaxed">
				Blueskyで通常の方法では削除できなくなったポストを強制的に削除するツールです。
			</p>
		</header>
	);
}

function Footer() {
	return (
		<footer className="mt-8 pt-4 border-t border-gray-200 text-xs text-gray-500">
			<div className="flex flex-wrap gap-x-4 gap-y-1">
				<a
					href={"https://bsky.app/profile/did:plc:qcwvyds5tixmcwkwrg3hxgxd"}
					target="_blank"
					rel="noopener noreferrer"
					className="hover:text-blue-600 hover:underline"
				>
					@tomo-x.win
				</a>
				<a
					href={"https://github.com/tomo-x7/bsky-post-cleaner"}
					target="_blank"
					rel="noopener noreferrer"
					className="hover:text-blue-600 hover:underline"
				>
					GitHub
				</a>
			</div>
			<p className="mt-2 text-gray-400">
				本ツールの利用は自己責任です。発生した問題について作者は責任を負いません。
			</p>
		</footer>
	);
}

export function Layout({ children }: PropsWithChildren) {
	return (
		<div className="min-h-screen bg-gray-50">
			<div className="max-w-md mx-auto px-4 py-6">
				<Header />
				{children}
				<Footer />
			</div>
		</div>
	);
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
	const [isLoading, setIsLoading] = useState(false);

	const handleLogin = async () => {
		if (!handle.trim()) {
			toast.error("ハンドルを入力してください");
			return;
		}
		setIsLoading(true);
		try {
			await client.signIn(handle.trim());
		} catch (e) {
			toast.error("ログインに失敗しました");
			setIsLoading(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleLogin();
		}
	};

	return (
		<div className="space-y-4">
			<div className="bg-white border border-gray-200 rounded-lg p-4">
				<h2 className="text-sm font-semibold text-gray-800 mb-3">ログイン</h2>
				<div className="space-y-3">
					<div>
						<label htmlFor="handle" className="block text-xs text-gray-600 mb-1">
							Blueskyハンドル
						</label>
						<input
							id="handle"
							type="text"
							value={handle}
							onChange={(e) => setHandle(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="example.bsky.social"
							disabled={isLoading}
							className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
						/>
					</div>
					<button
						type="button"
						onClick={handleLogin}
						disabled={isLoading || !handle.trim()}
						className="w-full py-2 px-4 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
					>
						{isLoading ? "ログイン中..." : "ログイン"}
					</button>
				</div>
			</div>
			<div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
				<p className="text-xs text-amber-800 leading-relaxed">
					OAuth認証を使用します。パスワードは本ツールに送信されません。
					<a
						href="https://whtwnd.com/did:plc:lfjssqqi6somnb7vhup2jm5w/3lyvtejbyy52m"
						target="_blank"
						rel="noopener noreferrer"
					>
						参考：OAuth認証についての解説
					</a>
				</p>
			</div>
		</div>
	);
}

function Main({ agent, handle: usrHandle }: { agent: Agent; handle: string | undefined }) {
	const [url, setUrl] = useState("");
	const [loading, setLoading] = useState(false);

	const handleClear = async () => {
		if (!url.trim()) {
			toast.error("URLを入力してください");
			return;
		}
		try {
			setLoading(true);
			const parsed = parseUri(url.trim());
			if (parsed == null) return;
			const { id, rkey } = parsed;
			if (id !== usrHandle && id !== agent.assertDid) {
				toast.error("自分以外のポストには使えません");
				return;
			}

			const post = await agent.app.bsky.feed
				.getPosts({
					uris: [`at://${agent.assertDid}/app.bsky.feed.post/${rkey}`],
				})
				.then((r) => r.data.posts[0]);
			if (post == null) {
				toast.error("ポストが見つかりません");
				return;
			}

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

			toast.success("ポストを削除しました");
			setUrl("");
		} catch (e) {
			console.error(e);
			toast.error("エラーが発生しました");
		} finally {
			setLoading(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !loading) {
			handleClear();
		}
	};

	return (
		<div className="space-y-4">
			<div className="bg-white border border-gray-200 rounded-lg p-4">
				<div className="flex items-center justify-between mb-3">
					<h2 className="text-sm font-semibold text-gray-800">ポストを削除</h2>
					<span className="text-xs text-gray-500">@{usrHandle}</span>
				</div>
				<div className="space-y-3">
					<div>
						<label htmlFor="post-url" className="block text-xs text-gray-600 mb-1">
							削除したいポストのURL
						</label>
						<input
							type="text"
							value={url}
							onChange={(e) => setUrl(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="https://bsky.app/profile/.../post/..."
							disabled={loading}
							className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
						/>
					</div>
					<button
						type="button"
						onClick={handleClear}
						disabled={loading || !url.trim()}
						className="w-full py-2 px-4 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
					>
						{loading ? "削除中..." : "削除する"}
					</button>
				</div>
			</div>

			<div className="bg-gray-100 border border-gray-200 rounded-lg p-3">
				<h3 className="text-xs font-semibold text-gray-700 mb-2">使い方</h3>
				<ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
					<li>削除できないポストのURLをコピー</li>
					<li>上の入力欄に貼り付け</li>
					<li>「削除する」ボタンをクリック</li>
				</ol>
			</div>

			<div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
				<h3 className="text-xs font-semibold text-amber-800 mb-1">注意</h3>
				<ul className="text-xs text-amber-700 space-y-1">
					<li>- 自分のポストのみ削除できます</li>
					<li>- 削除は取り消せません</li>
					<li>- 引用やリプライは残る場合があります</li>
				</ul>
			</div>
		</div>
	);
}

function parseUri(uri: string) {
	try {
		const aturi = new AtUri(uri);
		if (aturi.collection !== "app.bsky.feed.post" || aturi.rkey == null) {
			toast.error("ポストのURIを入力してください");
			return;
		}
		return { id: aturi.hostname, rkey: aturi.rkey };
	} catch {}
	if (!URL.canParse(uri)) {
		toast.error("無効なURL");
		return;
	}
	const parsed = new URL(uri);
	if (parsed.hostname !== "bsky.app") {
		toast.error("bsky.appのURLを入力してください");
		return;
	}
	const [, _profile, handle, _post, rkey] = parsed.pathname.split("/");
	if (_profile !== "profile" || !handle || _post !== "post" || !rkey) {
		toast.error("ポストのURLを入力してください");
		return;
	}
	return { id: handle, rkey };
}
