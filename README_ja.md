# funcity

テキスト処理機能を備えた関数型言語インタープリタ

![funcity](./images/funcity.120.png)

[![Project Status: WIP – Initial development is in progress, but there has not yet been a stable, usable release suitable for the public.](https://www.repostatus.org/badges/latest/wip.svg)](https://www.repostatus.org/#wip)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

|Package|npm|
|:----|:----|
|`funcity`|[![npm version](https://img.shields.io/npm/v/funcity.svg)](https://www.npmjs.com/package/funcity)|

---

[(English language is here)](./README.md)

## これは何?

これは、TypeScriptで実装された軽量な関数型言語処理系で、テキスト処理のための構文拡張機能を備えています。
CLIアプリケーションと、コアエンジンのみを含むライブラリパッケージが含まれています。

funcityは、[テキストテンプレートプロセッサ](https://en.wikipedia.org/wiki/Template_processor)の一種と捉えることが出来ます。
例えば、次のようなコードを入力すると:

```funcity
Today is {{if weather.sunny}}nice{{else}}bad{{end}}weather.
```

事前にコアエンジンに手動でバインドされた`weather`変数の値を評価し、異なるテキスト出力を生成します:

```
Today is bad weather.
```

テキスト中に記述された `if ... else ... end` によって、スクリプトが実行されていることはわかります。
しかし、これがなぜ「関数型言語」と言えるのでしょうか?
あるいは、他のテキストプロセッサとどう違うのでしょう?

別の同等の例を示しましょう：

```funcity
Today is {{cond weather.sunny 'nice' 'bad'}} weather.
```

これは関数適用の一例であり、`cond` 関数に3つの引数を適用した結果を挿入します。最初の引数は条件式です。

以下のコードも興味深いかも知れません:

```funcity
{{
set printWeather (fun w (cond w.sunny 'nice' 'bad'))
}}
Today is {{printWeather weather}} weather.
```

- `fun` は無名ラムダ関数を定義します。
- `set` は現在のスコープで、ミュータブルバインディングを実行します。

つまり、テキストテンプレートプロセッサに関数型言語のパワーを持ち込んだ処理系が、funcityです!

### 特徴

- 型なしラムダ計算を扱う、軽量な関数型言語プロセッサです。
  可能な限りシンプルな構文を採用しています。
  さらに、テキスト処理において優先すべき構文拡張を採用しています。
- すべての関数オブジェクトは非同期関数として扱われます。
  あなたは、関数適用時に非同期関数であることを意識する必要はありません。
- コアエンジンを利用したCLIも存在します。
  CLIは、REPLモードとテキスト処理モードの両方を備えています。
- コアエンジンには、トークナイザー、パーサー、インタープリタを含みます。
- コアエンジンライブラリは高い独立性を持ち、他のライブラリやパッケージに依存していません。
  あなたのアプリケーションへ、容易に組み込むことが出来ます。
- パーサーとインタープリタは、純粋な式を解釈させる場合と、完全なテキストプロセッシング構文を解釈させる場合の両方に対応しています。
  つまり、純粋な関数型言語のインタープリタが必要な場合においても、テキストプロセッシングの（不調和気味な）構文を完全に無視させることが可能です。
- 有用な標準関数実装をあらかじめバインド可能。

---

## パッケージインストール (CLI)

TODO:

```bash
npm install -D funcity-cli
```

または、グローバルにインストールするなら:

```bash
npm install -g funcity-cli
```

## 使い方 (CLI and REPL basic syntax)

TODO:

---

## パッケージインストール (ライブラリ)

```bash
npm install funcity
```

## 使い方 (ライブラリ)

funcityのコアエンジンは、ソースコードとなるスクリプト文字列を受け取り、それを実行し、結果として文字列を受け取ります。この一連の流れは、以下のようなプログラム言語処理系の典型的なワークフローで実現されます:

```mermaid
flowchart LR
  Script["Script text"] --> Tokenizer["Tokenizer"]
  Tokenizer --> Parser["Parser"]
  Parser --> Reducer["Reducer"]
  Reducer --> Text["Text output"]
```

- トークナイザーは、スクリプトテキストを解析して、funcityで使われる単語に分解する処理を行います。
- パーサーは、トークナイザーが分解したトークンから文脈を解析し、意味のあるノードデータ構造を構築します。
- インタープリタ(Reducer)は、ノードを解釈して計算を行います。これが連鎖的に実行されることにより、スクリプトコードが実行されることになります。

### 基本的な操作

一連の操作をコードで記述すると、以下のような最小の例となります:

```typescript
const run = async (
  script: string,
  errors: FunCityErrorInfo[] = []
): Promise<string> => {
  // トークナイザーの実行
  const blocks: FunCityToken[] = runTokenizer(script, errors);

  // パーサーの実行
  const nodes: FunCityBlockNode[] = runParser(blocks, errors);

  // インタープリタの実行
  const variables: FunCityVariables = buildCandidateVariables();
  const results: unknown[] = await runReducer(nodes, variables, errors);

  // すべての結果をテキストとして結合
  const text: string = results.join('');
  return text;
};
```

- インタープリタの出力は、生の計算結果です。また、複数の結果が得られる可能性があります。したがって、これらを文字列として結合して、最終的な出力テキストを得ます。
- スクリプトが一度読み込んだら変更されず、何度もインタープリタ実行だけを行いたい場合は、
  トークナイザーとパーサーの実行までを事前に行っておき、インタープリタだけ実行するようにすれば、効率よく処理できます。
- エラーやウォーニングは、 `errors` に追加されます。
  もし、エラーやウォーニングで早期に停止させたいなら、各処理が終了した時点で `errors` に記録があるかどうかを調べることができます。
- エラーがウォーニングが存在しても、インタープリタまで処理を続行できます。
  エラーが存在した箇所は、適当なトークン・ノードに置き換えられている可能性があり、それらの情報を使用してインタープリタを実行すると、正しく動作しない可能性が高いです。
  しかし、ある程度の構造が維持されるので、トークンやノードを解析して、より適切なエラーを生成出来るかもしれません。
- スクリプトの内容によっては、処理が完了しない可能性があります（例えば、無限ループなど）。
  `runReducer()`の引数に、`AbortSignal`を渡すことで、外部から実行を中断させることができます。

注意: このコードは、同様の関数が `runScriptOnce()` として公開されています。実際には`results`を、`convertToString()` を使用してテキスト化していることに注意してください。　

### 変数バインド

インタープリタは、引数に定義済みの変数群を渡すことができます。
あらかじめ変数を定義（バインド）しておけば、スクリプト内でこれを参照することができます:

```typescript
// buildCandidateVariables()は、標準関数を含めて任意の変数群を追加できる
const variables = buildCandidateVariables(
  {
    foo: 'ABCDE',  // `foo`という名前で文字列が参照できる
  },
);

// 例: `{{foo}}` ---> ['ABCDE']
const results = await runReducer(nodes, variables, errors);
```

### 関数オブジェクトのバインド

変数は、文字列や数値などのリテラル値だけではなく、任意の関数オブジェクトもバインドできます:

```typescript
// buildCandidateVariables()は、標準関数を含めて任意の変数群を追加できる
const variables = buildCandidateVariables(
  {
    bar: async (n: unknown) => Number(n) * 2,  // (非同期関数)
  }
);

// 例: `{{bar 21}}` ---> [42]
const results = await runReducer(nodes, variables, errors);
```

- 関数オブジェクトを指定する場合は、上記のように非同期関数を渡すことができます。
  これにより、インタープリタが内部で適切に非同期関数の遅延継続を行うので、I/O操作を含むどのような処理でも実現できます。
- 関数の引数の型を明示的に指定することもできますが、インタープリタはこの型を検査しません。
  したがって、指定した型を前提にコードを記述すると、スクリプトによって異なる型の値が渡された時に実行時エラーが発生するかもしれません。
  上記のように、常に`unkwnown`として受け取り、関数内で判定することをおすすめします。

この変数定義機能を使用すれば、あなたのアプリケーションの機能をスクリプト内で参照できるようになるため、
スクリプトの記述機能をユーザーに公開すれば、ユーザーが好きなように機能を拡張出来ることになります。

TODO:

---

## 標準関数

標準関数は、`standardVariables` から公開されるオブジェクトや、 `buildCandidateVariables()` が含める関数群で、
標準的に使用可能でかつ外部ライブラリに依存しない機能のみを使用して実装されています。

例えば、文字列や配列（`Iterable`オブジェクト）の文字列や要素数を取得する `length` 標準関数があります:

```funcity
{{length 'ABC'}}
```

以下に標準関数群を示します:

| 関数 | 説明 |
| :--- | :--- |
| `typeof` | 第1引数に指定されたインスタンスの型名を返します。 |
| `cond` | 第1引数の条件が真なら第2引数、偽なら第3引数を返します。 |
| `toString` | 引数群を文字列に変換します。 |
| `toBoolean` | 第1引数を真偽値に変換します。 |
| `toNumber` | 第1引数を数値に変換します。 |
| `toBigInt` | 第1引数をBigIntに変換します。 |
| `add` | 引数群を数値として加算します。 |
| `sub` | 引数群を数値として減算します。 |
| `mul` | 引数群を数値として乗算します。 |
| `div` | 第1引数を数値として第2引数で除算します。 |
| `mod` | 第1引数を数値として第2引数で除算した剰余を求めます。 |
| `equal` | 厳密比較（`===`）します。 |
| `now` | 現在時刻のUNIXミリ秒を返します。 |
| `concat` | 引数群の文字列や`Iterable`を順に連結します。 |
| `join` | 第1引数を区切り文字として、第2引数以降の文字列を結合します。 |
| `trim` | 第1引数の文字列の前後の空白を削除します。 |
| `toUpper` | 第1引数の文字列を大文字化します。 |
| `toLower` | 第1引数の文字列を小文字化します。 |
| `length` | 第1引数の文字列/配列/`Iterable`の長さを返します。 |
| `and` | 引数群を真偽値としてANDします。 |
| `or` | 引数群を真偽値としてORします。 |
| `not` | 第1引数を真偽値として否定を返します。 |
| `at` | 第1引数のインデックスで、第2引数の配列/`Iterable`から要素を取得します。 |
| `first` | 第1引数の配列/`Iterable`の先頭要素を返します。 |
| `last` | 第1引数の配列/`Iterable`の末尾要素を返します。 |
| `range` | 第1引数の数値から、第2引数個の連番配列を作ります。 |
| `sort` | `Iterable`を配列化し、既定順序でソートします。 |
| `reverse` | `Iterable`を逆順の配列にします。 |
| `map` | 第1引数の関数を、各要素に適用して配列を返します。 |
| `flatMap` | 第1引数の関数の結果を展開して結合します。 |
| `filter` | 第1引数の関数の結果が真の要素だけ返します。 |
| `collect` | 第1引数の関数の結果が`null`/`undefined`の場合を除外して配列化します。 |
| `reduce` | 第1引数の初期値と、第2引数の関数で畳み込みます。 |
| `match` | 第2引数について、第1引数の正規表現でマッチした結果を配列で返します。 |
| `replace` | 第3引数について、第1引数の正規表現でマッチした結果を第2引数で置換します。 |
| `regex` | 第1引数の正規表現と第2引数のオプションで、正規表現オブジェクトを生成します。 |
| `bind` | 第1引数の関数に、第2引数以降の引数を部分適用します。 |
| `url` | 第1引数と第2引数（任意）のベースURLからURLオブジェクトを生成します。 |

### typeof

`typeof` は、第1引数のインスタンスの型名を返します。
この関数は、JavaScriptの`typeof`に近いですが、以下の追加の判断も行います:

| 型 | 型名 |
| :--- | :--- |
| Null | `null` |
| 配列 | `array` |
| 列挙可能型 | `iterable` |

### cond

`cond`関数は、第1引数の真偽に応じて、第2引数の値、または第3引数の値を返します:

```funcity
{{cond true 'OK' 'NG'}}
```

通常の関数は、引数の式がすべて評価されます。

しかしこの関数は特殊で、第2第3引数は、第1引数の結果でどちらかだけが評価されます。

### toString,toBoolean,toNumber,toBigInt

これらの関数は、第1引数を文字列/真偽値/数値/BigIntに変換します。

```funcity
{{toString 123 'ABC'}}
{{toBoolean 0}}
{{toNumber '123'}}
{{toBigInt '9007199254740993'}}
```

- `toString` は、複数の引数群をそれぞれ文字列化し、それをカンマで連結します。文字列化は独自のpretty print規則によります。
- `toBoolean` は、funcityの条件判定ルールに従い、`false`/`null`/`undefined` は偽、`0`/`0n` は偽、それ以外は真になります。
- `toNumber` は、JavaScript の `Number(...)`、`toBigInt` は `BigInt(...)` を使います。
- `toBigInt` がプリミティブ以外を受け取る場合は、 `toString` と同じ文字列変換を行ってからBigIntに変換します。

### add,mul,and,or

これらの関数は、複数の引数を指定できます:

```funcity
{{add 2 5 4 3 9}}
```

`and`, `or` については、1個以上の引数が必要です。
左から評価し、結果が確定した時点で評価を打ち切ります（`and` は最初の偽、`or` は最初の真）。

### at,first,last

配列/`Iterable`から要素を取り出します:

```funcity
{{at 1 [12 34 56]}}
{{first [12 34 56]}}
{{last [12 34 56]}}
```

`at` のインデックスは0始まりです。

### range

開始値と個数を指定して連番配列を作ります:

```funcity
{{range 3 5}}
```

結果は、 `[3 4 5 6 7]` のような配列です。

### map,flatMap,filter

第1引数に、引数を一つ受け取る関数を渡します。ラムダ式でもバインドされた変数でも構いません。
第2引数に、配列のような`Iterable`オブジェクトを渡すことで、逐次処理を実行できます:

```funcity
{{map (fun [x] (mul x 10)) [12 34 56]}}
{{flatMap (fun [x] [(mul x 10) (add x 1)]) [1 2]}}
{{filter (fun [x] (mod x 2)) [1 2 3 4]}}
```

### collect

`null`/`undefined` を除外して配列化します:

```funcity
{{collect [1 undefined 3 null 4]}}
```

結果は、 `[1 3 4]` のような配列です。

### reduce

第1引数に、初期値を指定します。
第2引数に、引数を2つ取る畳み込み関数を指定します。
第3引数に、配列のような`Iterable`オブジェクトを渡すことで、畳み込み処理を実行できます:

```funcity
{{reduce 'A' (fun [acc v] (concat acc v)) ['B' 'C' 'D']}}
```

結果は、 `'ABCD'` です。

### regex

第1引数に、正規表現の文字列を指定します。
第2引数に、[正規表現のオプション（例えば`'g'`や`'i'`など）](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions#advanced_searching_with_flags)を指定します。

```funcity
{{set r (regex '[A-Z]' 'gi')}}
```

### match

第1引数の正規表現は、文字列でも `regex` オブジェクトでも指定できます。
第2引数に、検査する文字列を指定します:

```funcity
{{match (regex '[A-Z]' 'gi') 'Hello World'}}
```

結果は、 `['H' 'e' 'l' 'l' 'o' 'W' 'o' 'r' 'l' 'd']` のような配列です。

### replace

第1引数の正規表現は、文字列でも `regex` オブジェクトでも指定できます:

```funcity
{{replace 'dog' 'ferret' 'dog is cute'}}
```

結果は、 `'ferret is cute'` です。

### bind

関数に引数を部分適用して返します:

```funcity
{{(bind add 123) 100}}
```

結果は、 `223` です。

### url

第1引数のURL文字列と、第2引数のベースURL（任意）からURLオブジェクトを生成します:

```funcity
{{set u (url '/path' 'https://example.com/base/')}}
```

結果は、`https://example.com/base/path` を表す `URL` オブジェクトです。

---

## 備考

funcityは、ドキュメントサイトジェネレータ [mark-the-ripper](https://github.com/kekyo/mark-the-ripper) を設計中に、
スクリプトエンジンとして独立させたほうが良さそうだと考えて分離したものです。

したがって、mark-the-ripperはfuncityの関数型言語のパワーを享受できます。

## ライセンス

Under MIT.
