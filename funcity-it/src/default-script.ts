// funcity - A functional language interpreter with text processing
// Copyright (c) Kouji Matsui (@kekyo@mi.kekyo.net)
// Under MIT.
// https://github.com/kekyo/funcity/

export const DEFAULT_SCRIPT = `{{
set fib (fun n \\
  (cond (le n 1) \\
    n \\
    (add (fib (sub n 1)) (fib (sub n 2)))))
}}
Fibonacci (10) = {{fib 10}}`;
