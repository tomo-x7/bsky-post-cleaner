import type { Agent } from "@atproto/api";
import type { BrowserOAuthClient } from "@atproto/oauth-client-browser";
import { AtUri } from "@atproto/syntax";
import { type PropsWithChildren, useState } from "react";
import { toast } from "react-hot-toast";

function Header() {
	return (
		<header className="mb-4 sm:mb-5">
			<h1 className="text-lg sm:text-xl font-bold text-gray-900">bsky-post-cleaner</h1>
			<p className="text-xs sm:text-sm text-gray-500 mt-0.5">通常削除できないBlueskyポストを強制削除</p>
		</header>
	);
}

function Footer() {
	return (
		<footer className="mt-6 sm:mt-8 pt-3 sm:pt-4 border-t border-gray-200 text-[11px] sm:text-xs text-gray-400 flex flex-wrap items-center gap-x-3 gap-y-1">
			<a
				href="https://bsky.app/profile/did:plc:qcwvyds5tixmcwkwrg3hxgxd"
				target="_blank"
				rel="noopener noreferrer"
				className="hover:text-blue-500 transition-colors"
			>
				@tomo-x.win
			</a>
			<span className="text-gray-300">|</span>
			<a
				href="https://github.com/tomo-x7/bsky-post-cleaner"
				target="_blank"
				rel="noopener noreferrer"
				className="hover:text-blue-500 transition-colors"
			>
				GitHub
			</a>
			<span className="basis-full text-[10px] sm:text-[11px] text-gray-300 mt-1">利用は自己責任です</span>
		</footer>
	);
}

export function Layout({ children }: PropsWithChildren) {
	return (
		<div className="min-h-screen bg-gray-50 flex flex-col">
			<div className="flex-1 w-full max-w-md sm:max-w-lg mx-auto px-4 py-4 sm:py-6">
				<Header />
				<main>{children}</main>
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
	const [changeUsr, setChangeUsr] = useState(false);
	if (agent == null || changeUsr) {
		return <Signin client={client} onBack={changeUsr ? () => setChangeUsr(false) : undefined} />;
	}
	return <Main agent={agent} handle={handle} onChangeUser={() => setChangeUsr(true)} />;
}

function Signin({ client, onBack }: { client: BrowserOAuthClient; onBack?: () => void }) {
	const [handle, setHandle] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const handleLogin = async () => {
		const trimmed = handle.trim();
		if (!trimmed) {
			toast.error("ハンドルを入力してください");
			return;
		}
		setIsLoading(true);
		try {
			await client.signIn(trimmed);
		} catch {
			toast.error("ログインに失敗しました");
			setIsLoading(false);
		}
	};

	return (
		<div className="space-y-3 sm:space-y-4">
			<div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
				<div className="flex items-center justify-between mb-2 sm:mb-3">
					<h2 className="text-sm sm:text-base font-semibold text-gray-800">ログイン</h2>
					{onBack && (
						<button
							type="button"
							onClick={onBack}
							className="text-[11px] sm:text-xs text-gray-500 hover:text-gray-700 transition-colors"
						>
							キャンセル
						</button>
					)}
				</div>
				<label className="block mb-2 sm:mb-3">
					<span className="text-[11px] sm:text-xs text-gray-500">Blueskyハンドル</span>
					<input
						type="text"
						value={handle}
						onChange={(e) => setHandle(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && handleLogin()}
						placeholder="example.bsky.social"
						disabled={isLoading}
						className="mt-1 w-full px-3 py-2 sm:py-2.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400 transition-colors"
					/>
				</label>
				<button
					type="button"
					onClick={handleLogin}
					disabled={isLoading || !handle.trim()}
					className="w-full py-2 sm:py-2.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
				>
					{isLoading ? "ログイン中..." : "ログイン"}
				</button>
			</div>
			<p className="text-[11px] sm:text-xs text-gray-400 leading-relaxed px-1">
				OAuth認証を使用。パスワードは送信されません。
				<a
					href="https://whtwnd.com/did:plc:lfjssqqi6somnb7vhup2jm5w/3lyvtejbyy52m"
					target="_blank"
					rel="noopener noreferrer"
					className="ml-1 text-blue-500 hover:underline"
				>
					詳細
				</a>
			</p>
		</div>
	);
}

function Main({
	agent,
	handle: usrHandle,
	onChangeUser,
}: {
	agent: Agent;
	handle: string | undefined;
	onChangeUser: () => void;
}) {
	const [url, setUrl] = useState("");
	const [loading, setLoading] = useState(false);

	const handleClear = async () => {
		const trimmed = url.trim();
		if (!trimmed) {
			toast.error("URLを入力してください");
			return;
		}
		setLoading(true);
		try {
			const parsed = parseUri(trimmed);
			if (!parsed) return;
			const { id, rkey } = parsed;
			if (id !== usrHandle && id !== agent.assertDid) {
				toast.error("自分以外のポストには使えません");
				return;
			}

			await agent.com.atproto.repo.putRecord({
				repo: agent.assertDid,
				collection: "app.bsky.feed.post",
				rkey,
				record: {
					text: `bsky-post-cleanerにより削除中\n削除日時:${new Date().toString()}`,
					via: "bsky-post-cleaner",
					createdAt: new Date(Date.now() - 86400000).toISOString(),
				},
			});
			await agent.com.atproto.repo.deleteRecord({
				repo: agent.assertDid,
				collection: "app.bsky.feed.post",
				rkey,
			});

			toast.success("削除しました");
			setUrl("");
		} catch (e) {
			console.error(e);
			toast.error("エラーが発生しました");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="space-y-3 sm:space-y-4">
			<div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
				<div className="flex items-center justify-between mb-2 sm:mb-3">
					<h2 className="text-sm sm:text-base font-semibold text-gray-800">ポストを削除</h2>
					<div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px]">
						<span className="text-gray-400">@{usrHandle}</span>
						<button
							type="button"
							onClick={onChangeUser}
							className="text-blue-500 hover:text-blue-600 hover:underline transition-colors"
						>
							変更
						</button>
					</div>
				</div>
				<label className="block mb-2 sm:mb-3">
					<span className="text-[11px] sm:text-xs text-gray-500">削除するポストのURL</span>
					<input
						type="url"
						value={url}
						onChange={(e) => setUrl(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && !loading && handleClear()}
						placeholder="https://bsky.app/profile/.../post/..."
						disabled={loading}
						className="mt-1 w-full px-3 py-2 sm:py-2.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400 transition-colors"
					/>
				</label>
				<button
					type="button"
					onClick={handleClear}
					disabled={loading || !url.trim()}
					className="w-full py-2 sm:py-2.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
				>
					{loading ? "削除中..." : "削除する"}
				</button>
			</div>

			<details className="text-[11px] sm:text-xs text-gray-500 px-1">
				<summary className="cursor-pointer hover:text-gray-700 transition-colors">使い方</summary>
				<ol className="mt-1.5 ml-4 list-decimal space-y-0.5">
					<li>削除できないポストのURLをコピー</li>
					<li>上の入力欄に貼り付け</li>
					<li>削除ボタンをクリック</li>
				</ol>
			</details>

			<p className="text-[10px] sm:text-[11px] text-amber-600 px-1">
				自分のポストのみ対象。削除は取り消せません。
			</p>
		</div>
	);
}

function parseUri(uri: string) {
	try {
		const aturi = new AtUri(uri);
		if (aturi.collection === "app.bsky.feed.post" && aturi.rkey) {
			return { id: aturi.hostname, rkey: aturi.rkey };
		}
	} catch {
		// fallthrough to URL parsing
	}

	if (!URL.canParse(uri)) {
		toast.error("無効なURL");
		return null;
	}

	const parsed = new URL(uri);
	if (parsed.hostname !== "bsky.app") {
		toast.error("bsky.appのURLを入力してください");
		return null;
	}

	const segments = parsed.pathname.split("/");
	const profileIdx = segments.indexOf("profile");
	const postIdx = segments.indexOf("post");

	if (profileIdx === -1 || postIdx === -1 || postIdx <= profileIdx + 1) {
		toast.error("ポストのURLを入力してください");
		return null;
	}

	const handle = segments[profileIdx + 1];
	const rkey = segments[postIdx + 1];

	if (!handle || !rkey) {
		toast.error("ポストのURLを入力してください");
		return null;
	}

	return { id: handle, rkey };
}
