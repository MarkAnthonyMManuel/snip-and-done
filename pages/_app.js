import '../styles/globals.css';

function MyApp({ Component, pageProps }) {
    return (
        <div className="min-h-screen bg-orange-50">
            <Component {...pageProps} />
        </div>
    );
}

export default MyApp;