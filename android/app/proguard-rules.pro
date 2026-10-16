# NovaDrop ProGuard Rules
-keepattributes *Annotation*
-keepclassmembers class * {
    @androidx.room.* <methods>;
}
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class androidx.media3.** { *; }

# NewPipeExtractor & Rhino JS Engine
-keep class org.mozilla.javascript.** { *; }
-keep class org.mozilla.classfile.ClassFileWriter
-dontwarn org.mozilla.javascript.tools.**
-dontwarn org.jsoup.**
