'use client';

import { type FormEvent, startTransition, useActionState, useEffect, useRef } from 'react';

/**
 * 表單送出動作。React 19 的 <form action> 在動作結束後一律把欄位重設回 defaultValue，
 * 伺服器驗證失敗時使用者剛輸入的內容會被清掉（單選鈕甚至會變成沒選）。
 * 這裡改由 onSubmit 攔下送出、自己在 transition 中執行動作，表單就不會被重設；
 * action 仍綁在 <form> 上，JavaScript 還沒載入時照樣可以送出。
 *
 * 用法：<form ref={formRef} action={formAction} onSubmit={onSubmit}>
 * resetOnSuccess：新增用的表單在儲存成功（state.saved）後清空，方便繼續新增。
 */
export function useFormAction<State>(
  action: (state: Awaited<State>, formData: FormData) => State | Promise<State>,
  initialState: Awaited<State>,
  { resetOnSuccess = false }: { resetOnSuccess?: boolean } = {},
) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && (state as { saved?: boolean } | null)?.saved) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => formAction(formData));
  };

  return { state, formAction, onSubmit, pending, formRef };
}
