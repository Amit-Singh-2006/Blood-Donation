package com.lifelink.blooddonation;

import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.widget.Toast;
import androidx.annotation.RequiresApi;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.Arrays;
import java.util.List;

/**
 * Saves a file the website made (a certificate, report, document, backup codes
 * or a registration list) to Downloads/LifeLink and opens it. A WebView cannot
 * download a file the page made itself (a blob: link), so src/lib/files.ts
 * hands it to this plugin instead.
 */
@CapacitorPlugin(name = "LifeLinkFiles")
public class FilesPlugin extends Plugin {
    private static final List<String> TYPES = Arrays.asList(
        "application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain", "text/csv");
    private static final int MAX_BYTES = 20 * 1024 * 1024;

    @PluginMethod
    public void save(PluginCall call) {
        String data = call.getString("data");
        String fileName = call.getString("name");
        String type = call.getString("type");
        if (data == null || fileName == null || type == null || !TYPES.contains(type)) {
            call.reject("This kind of file cannot be saved.");
            return;
        }
        byte[] bytes;
        try {
            bytes = Base64.decode(data, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("This file could not be read.");
            return;
        }
        if (bytes.length == 0 || bytes.length > MAX_BYTES) {
            call.reject("This file is too large to save.");
            return;
        }
        String name = fileName.replaceAll("[^A-Za-z0-9._ -]", "_").replaceAll("^[._ ]+", "");
        if (name.isEmpty()) name = "LifeLink file";
        if (name.length() > 100) name = name.substring(name.length() - 100);

        try {
            boolean inDownloads = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q;
            Uri uri = inDownloads ? saveToDownloads(bytes, name, type) : saveToCache(bytes, name);
            String shown = name;
            getActivity().runOnUiThread(() -> {
                if (inDownloads) Toast.makeText(getContext(), "Saved in Downloads/LifeLink: " + shown, Toast.LENGTH_LONG).show();
                open(uri, type, !inDownloads);
            });
            call.resolve();
        } catch (IOException | RuntimeException e) {
            call.reject("The app could not save the file.", e);
        }
    }

    @RequiresApi(api = Build.VERSION_CODES.Q)
    private Uri saveToDownloads(byte[] bytes, String name, String type) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
        values.put(MediaStore.MediaColumns.MIME_TYPE, type);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/LifeLink");
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);
        Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (uri == null) throw new IOException("Downloads is not available");
        try (OutputStream out = resolver.openOutputStream(uri)) {
            if (out == null) throw new IOException("Could not write the file");
            out.write(bytes);
        } catch (IOException e) {
            resolver.delete(uri, null, null);
            throw e;
        }
        values.clear();
        values.put(MediaStore.MediaColumns.IS_PENDING, 0);
        resolver.update(uri, values, null, null);
        return uri;
    }

    /** Android 9 and older: a private copy, which the person then opens or shares. */
    private Uri saveToCache(byte[] bytes, String name) throws IOException {
        Context context = getContext();
        File dir = new File(context.getCacheDir(), "saved");
        if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("No room for the file");
        File file = new File(dir, name);
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(bytes);
        }
        return FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", file);
    }

    private void open(Uri uri, String type, boolean shareIfNoViewer) {
        Intent view = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, type).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try {
            getActivity().startActivity(view);
        } catch (ActivityNotFoundException noViewer) {
            if (!shareIfNoViewer) return;
            Intent send = new Intent(Intent.ACTION_SEND).setType(type).putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            try {
                getActivity().startActivity(Intent.createChooser(send, null));
            } catch (ActivityNotFoundException ignored) {
                Toast.makeText(getContext(), "No app on this phone can open this file.", Toast.LENGTH_LONG).show();
            }
        }
    }
}
