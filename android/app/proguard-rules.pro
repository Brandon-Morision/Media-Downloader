# NovaDrop ProGuard Rules
-keepattributes *Annotation*
-keepclassmembers class * {
    @androidx.room.* <methods>;
}
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class androidx.media3.** { *; }

# NewPipeExtractor & Rhino JS Engine
-keep class org.schabi.newpipe.extractor.** { *; }
-keep interface org.schabi.newpipe.extractor.** { *; }
-keep class org.mozilla.javascript.** { *; }
-keep class org.mozilla.classfile.ClassFileWriter
-dontwarn org.mozilla.javascript.tools.**
-dontwarn org.mozilla.javascript.engine.**
-dontwarn java.beans.**
-dontwarn javax.script.**
-dontwarn org.jsoup.**
-dontwarn jdk.dynalink.**

# youtubedl-android (Jackson mapper, commons-compress, JNI bindings)
-keep class com.yausername.** { *; }
-dontwarn com.yausername.**
-keep class com.fasterxml.jackson.annotation.** { *; }
-keepclassmembers class * {
    @com.fasterxml.jackson.annotation.* <methods>;
    @com.fasterxml.jackson.annotation.* <fields>;
}
-keep class org.apache.commons.compress.archivers.zip.** { *; }

-dontwarn org.w3c.dom.bootstrap.**
-dontwarn com.fasterxml.jackson.databind.ext.**

# Spike Manager & Service
-keep class com.novadrop.android.spike.** { *; }

