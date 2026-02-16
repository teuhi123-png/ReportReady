import type { AppProps } from "next/app";
import Head from "next/head";
import "../styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>SiteMind AI Assistant</title>
        <meta
          name="description"
          content="SiteMind AI Assistant helps teams upload site plan PDFs and chat with AI for fast, contextual answers."
        />
        <meta name="application-name" content="SiteMind AI Assistant" />
        <meta name="apple-mobile-web-app-title" content="SiteMind AI Assistant" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
