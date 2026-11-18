package com.safeyatra.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.safeyatra.app.mesh.SafeYatraMeshPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register the Safe Yatra Offline Finding Network plugin
        registerPlugin(SafeYatraMeshPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
