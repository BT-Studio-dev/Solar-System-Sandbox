package dev.btstudio.solarsystem;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.graphics.Color;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.ValueCallback;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/** Offline WebView. The sole JavaScript bridge exports bounded JSON to a user-selected document. */
public final class MainActivity extends Activity {
    private static final String ORIGIN = "https://sandbox.local/";
    private static final int PICK_JSON = 4101, SAVE_JSON = 4102, MAX_JSON_BYTES = 1_000_000;
    private WebView web;
    private ValueCallback<Uri[]> pendingFile;
    private byte[] pendingExport;
    private String pendingExportName;

    private final class NativeExport {
        @JavascriptInterface public void saveJson(String name, String contents) {
            if (contents == null || contents.getBytes(StandardCharsets.UTF_8).length > MAX_JSON_BYTES) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "JSON export exceeds 1 MB", Toast.LENGTH_SHORT).show());
                return;
            }
            String safeName = name == null ? "solar-system-v2.json" : name.replaceAll("[^A-Za-z0-9._-]", "_");
            if (!safeName.toLowerCase().endsWith(".json")) safeName += ".json";
            final String outputName = safeName;
            byte[] bytes = contents.getBytes(StandardCharsets.UTF_8);
            runOnUiThread(() -> {
                pendingExport = bytes;
                pendingExportName = outputName;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE, pendingExportName);
                try { startActivityForResult(intent, SAVE_JSON); }
                catch (Exception error) { pendingExport = null; pendingExportName = null;
                    Toast.makeText(MainActivity.this, "No file picker is available", Toast.LENGTH_SHORT).show(); }
            });
        }
    }

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
        // The file picker grants access only to the JSON document the user explicitly selects.
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        web.addJavascriptInterface(new NativeExport(), "AndroidAero");
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pendingFile != null) pendingFile.onReceiveValue(null);
                pendingFile = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try { startActivityForResult(intent, PICK_JSON); }
                catch (Exception error) { pendingFile = null; callback.onReceiveValue(null); return false; }
                return true;
            }
        });
        web.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            // The app's export path calls the bounded, native file-picker bridge directly.
            // Refuse arbitrary external downloads: this app has no network permission.
        });
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                // Only the two bundled app modes may navigate. External URLs stay blocked.
                return !(url.equals(ORIGIN) || url.equals(ORIGIN + "index.html") ||
                    url.equals(ORIGIN + "classic.html"));
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
        android.widget.FrameLayout container = new android.widget.FrameLayout(this);
        container.addView(web, new android.widget.FrameLayout.LayoutParams(
            android.view.ViewGroup.LayoutParams.MATCH_PARENT,
            android.view.ViewGroup.LayoutParams.MATCH_PARENT));
        // Android 15 enforces edge-to-edge for target SDK 35. Keep controls clear
        // of the status/navigation bars and display cutouts on those devices.
        if (android.os.Build.VERSION.SDK_INT >= 35) {
            container.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets bars = insets.getInsets(
                    android.view.WindowInsets.Type.systemBars() |
                    android.view.WindowInsets.Type.displayCutout());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return insets;
            });
        }
        setContentView(container);
        web.loadUrl(ORIGIN);
    }
    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == PICK_JSON) {
            if (pendingFile != null) {
                Uri[] result = resultCode == RESULT_OK && data != null && data.getData() != null
                    ? new Uri[] { data.getData() } : null;
                pendingFile.onReceiveValue(result);
                pendingFile = null;
            }
            return;
        }
        if (requestCode == SAVE_JSON) {
            byte[] bytes = pendingExport;
            pendingExport = null;
            pendingExportName = null;
            if (resultCode != RESULT_OK || data == null || data.getData() == null || bytes == null) return;
            try (OutputStream output = getContentResolver().openOutputStream(data.getData())) {
                if (output == null) throw new IOException("Could not open selected document");
                output.write(bytes);
                Toast.makeText(this, "Version 2 JSON saved", Toast.LENGTH_SHORT).show();
            } catch (IOException error) {
                Toast.makeText(this, "Could not write the selected document", Toast.LENGTH_LONG).show();
            }
        }
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
