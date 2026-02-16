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
          content="SiteMind AI Assistant for uploading site plan PDFs and chatting with AI about plan details."
        />
        <meta name="application-name" content="SiteMind AI Assistant" />
        <meta name="apple-mobile-web-app-title" content="SiteMind AI Assistant" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
