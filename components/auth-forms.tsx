'use client';

import { useActionState, useState } from 'react';
import { loginAction, registerAction } from '@/app/account/actions';

const inputClass =
  'h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20';

export function AuthForms() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loginState, loginFormAction, loginPending] = useActionState(loginAction, null);
  const [registerState, registerFormAction, registerPending] = useActionState(
    registerAction,
    null,
  );

  return (
    <div className="mt-8 max-w-md">
      <div className="flex gap-1 rounded-full border border-zinc-800 bg-zinc-900/50 p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode('login')}
          aria-pressed={mode === 'login'}
          className={`flex-1 rounded-full px-4 py-1.5 transition ${
            mode === 'login'
              ? 'bg-cyan-500 font-medium text-zinc-950'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          登录
        </button>
        <button
          type="button"
          onClick={() => setMode('register')}
          aria-pressed={mode === 'register'}
          className={`flex-1 rounded-full px-4 py-1.5 transition ${
            mode === 'register'
              ? 'bg-cyan-500 font-medium text-zinc-950'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          注册
        </button>
      </div>

      {mode === 'login' ? (
        <form action={loginFormAction} className="mt-5 space-y-3">
          <label className="block text-xs text-zinc-500" htmlFor="login-email">
            邮箱
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className={inputClass}
          />
          <label className="block text-xs text-zinc-500" htmlFor="login-password">
            密码
          </label>
          <input
            id="login-password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className={inputClass}
          />
          {loginState?.error && <p className="text-xs text-rose-300">{loginState.error}</p>}
          <button
            type="submit"
            disabled={loginPending}
            className="h-11 w-full rounded-lg bg-cyan-500 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-400 disabled:cursor-wait disabled:opacity-60"
          >
            {loginPending ? '登录中…' : '登录'}
          </button>
        </form>
      ) : (
        <form action={registerFormAction} className="mt-5 space-y-3">
          <label className="block text-xs text-zinc-500" htmlFor="register-email">
            邮箱
          </label>
          <input
            id="register-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className={inputClass}
          />
          <label className="block text-xs text-zinc-500" htmlFor="register-password">
            密码（至少 8 位）
          </label>
          <input
            id="register-password"
            name="password"
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            placeholder="••••••••"
            className={inputClass}
          />
          <label className="block text-xs text-zinc-500" htmlFor="register-confirm">
            确认密码
          </label>
          <input
            id="register-confirm"
            name="confirm"
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            placeholder="再次输入密码"
            className={inputClass}
          />
          <p className="text-xs text-zinc-600">
            昵称默认取邮箱前缀，注册后可在个人账号中修改。
            <br />
            第一个注册的账号将成为 Master（内部账号），之后注册的账号为 Player。
          </p>
          {registerState?.error && (
            <p className="text-xs text-rose-300">{registerState.error}</p>
          )}
          <button
            type="submit"
            disabled={registerPending}
            className="h-11 w-full rounded-lg bg-cyan-500 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-400 disabled:cursor-wait disabled:opacity-60"
          >
            {registerPending ? '注册中…' : '注册并登录'}
          </button>
        </form>
      )}
    </div>
  );
}
