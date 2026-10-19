package dev.btstudio.solarsystem;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

/** Sandboxed offline WebView. No Javascript bridges and no network permission. */
public final class MainActivity extends Activity {
    private static final String ORIGIN = "https://sandbox.local/";
    private WebView web;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(8, 13, 23));
        getWindow().setNavigationBarColor(Color.rgb(8, 13, 23));
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(8, 13, 23));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return true; // No navigation or external browser launches.
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (!url.startsWith(ORIGIN)) return blocked();
                String path = request.getUrl().getPath();
                if (path == null || path.contains("..") || path.contains("\\")) return blocked();
                if (path.equals("/")) path = "/index.html";
                String mime = path.endsWith(".html") ? "text/html" :
                    path.endsWith(".css") ? "text/css" :
                    path.endsWith(".js") ? "text/javascript" :
                    path.endsWith(".svg") ? "image/svg+xml" : "application/octet-stream";
                try {
                    Map<String, String> headers = new HashMap<>();
                    headers.put("Cache-Control", "no-cache");
                    headers.put("X-Content-Type-Options", "nosniff");
                    return new WebResourceResponse(mime, "UTF-8", 200, "OK", headers,
                        getAssets().open("web" + path));
                } catch (IOException error) { return blocked(); }
            }
            private WebResourceResponse blocked() {
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
                    null, new ByteArrayInputStream(new byte[0]));
            }
        });
        setContentView(web);
        web.loadUrl(ORIGIN);
    }
    @Override protected void onPause() {
        if (web != null) web.onPause();
        super.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }
    @Override protected void onDestroy() {
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }
}
