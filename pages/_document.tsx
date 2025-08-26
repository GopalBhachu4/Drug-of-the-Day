import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <script src="https://cdn.tailwindcss.com"></script>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <body className="bg-slate-50">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
