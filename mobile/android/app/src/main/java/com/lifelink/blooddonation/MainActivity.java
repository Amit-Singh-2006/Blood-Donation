package com.lifelink.blooddonation;

import android.os.Bundle;
import android.webkit.CookieManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // The website signs in with cookies set by the API, which lives on another
        // domain. Chrome allows those; an app's WebView blocks them unless told to.
        CookieManager.getInstance().setAcceptThirdPartyCookies(getBridge().getWebView(), true);
    }
}
