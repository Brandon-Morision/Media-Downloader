# Third-Party Software Notices and Licenses

NovaDrop Android incorporates and links against several open-source libraries and components. This document provides the full inventory of all direct and transitive third-party dependencies, their licenses, copyright notices, and source repository locations.

---

## 1. Project Licensing & Corresponding Source Notice

**NovaDrop Android** links directly with **NewPipeExtractor** (`org.schabi.newpipe.extractor`), which is licensed under the **GNU General Public License v3.0 (GPL-3.0)**. 

In accordance with Section 5 and Section 6 of the GNU General Public License v3.0:
- Any distribution of NovaDrop Android in compiled or executable binary form constitutes a combined work under the GPL-3.0.
- NovaDrop Android is released under the **GNU General Public License v3.0**.
- The Complete Corresponding Source Code for NovaDrop Android, including all build scripts, source code, and instructions required to generate the runnable binary, is made available in the source repository: `https://github.com/Brandon-Morision/Media-Downloader`.

---

## 2. Direct & Transitive Dependency Inventory

| Component Name | Resolved Version | Direct / Transitive | License | Upstream Project URL |
| :--- | :--- | :--- | :--- | :--- |
| **NewPipeExtractor** | `v0.26.5` | Direct | **GNU GPL v3.0** | [github.com/TeamNewPipe/NewPipeExtractor](https://github.com/TeamNewPipe/NewPipeExtractor) |
| **nanojson** | `e9d656dd` | Transitive (NewPipeExtractor) | **Apache License 2.0** | [github.com/mmastrac/nanojson](https://github.com/mmastrac/nanojson) |
| **jsoup** | `1.22.2` | Transitive (NewPipeExtractor) | **MIT License** | [github.com/jhy/jsoup](https://github.com/jhy/jsoup) |
| **JSR 305 Annotations** | `3.0.2` | Transitive (NewPipeExtractor) | **Apache License 2.0 / BSD** | [github.com/findbugsproject/findbugs](https://github.com/findbugsproject/findbugs) |
| **Protocol Buffers [Java Lite]** | `4.35.1` | Transitive (NewPipeExtractor) | **BSD 3-Clause** | [github.com/protocolbuffers/protobuf](https://github.com/protocolbuffers/protobuf) |
| **Mozilla Rhino** | `1.8.1` | Transitive (NewPipeExtractor) | **Mozilla Public License 2.0 (MPL 2.0)** | [github.com/mozilla/rhino](https://github.com/mozilla/rhino) |
| **Mozilla Rhino Engine** | `1.8.1` | Transitive (NewPipeExtractor) | **Mozilla Public License 2.0 (MPL 2.0)** | [github.com/mozilla/rhino](https://github.com/mozilla/rhino) |
| **Square OkHttp** | `4.12.0` | Direct | **Apache License 2.0** | [github.com/square/okhttp](https://github.com/square/okhttp) |
| **Square OkHttp Logging Interceptor** | `4.12.0` | Direct | **Apache License 2.0** | [github.com/square/okhttp](https://github.com/square/okhttp) |
| **Square Okio** | `3.9.0` | Transitive (OkHttp, DataStore) | **Apache License 2.0** | [github.com/square/okio](https://github.com/square/okio) |
| **Coil Compose** | `2.7.0` | Direct | **Apache License 2.0** | [github.com/coil-kt/coil](https://github.com/coil-kt/coil) |
| **AndroidX Core KTX** | `1.15.0` | Direct | **Apache License 2.0** | [developer.android.com/jetpack/androidx](https://developer.android.com/jetpack/androidx) |
| **AndroidX Lifecycle Runtime / Compose / ViewModel** | `2.8.7` | Direct | **Apache License 2.0** | [developer.android.com/jetpack/androidx](https://developer.android.com/jetpack/androidx) |
| **AndroidX Activity Compose** | `1.9.3` | Direct | **Apache License 2.0** | [developer.android.com/jetpack/androidx](https://developer.android.com/jetpack/androidx) |
| **AndroidX Compose BOM** | `2024.11.00` | Direct | **Apache License 2.0** | [developer.android.com/jetpack/androidx](https://developer.android.com/jetpack/androidx) |
| **AndroidX Navigation Compose** | `2.8.4` | Direct | **Apache License 2.0** | [developer.android.com/jetpack/androidx](https://developer.android.com/jetpack/androidx) |
| **AndroidX Media3 (ExoPlayer, UI, Session)** | `1.5.0` | Direct | **Apache License 2.0** | [github.com/androidx/media](https://github.com/androidx/media) |
| **AndroidX Room (Runtime, KTX, Compiler)** | `2.6.1` | Direct | **Apache License 2.0** | [developer.android.com/jetpack/androidx](https://developer.android.com/jetpack/androidx) |
| **AndroidX DataStore Preferences** | `1.1.1` | Direct | **Apache License 2.0** | [developer.android.com/jetpack/androidx](https://developer.android.com/jetpack/androidx) |
| **Kotlin Standard Library** | `2.0.21` | Direct | **Apache License 2.0** | [github.com/JetBrains/kotlin](https://github.com/JetBrains/kotlin) |
| **Kotlinx Coroutines Android / Core** | `1.9.0` | Direct | **Apache License 2.0** | [github.com/Kotlin/kotlinx.coroutines](https://github.com/Kotlin/kotlinx.coroutines) |
| **Android Tools Desugar JDK Libs** | `2.1.3` | Direct (Core Desugaring) | **Apache License 2.0** | [android.googlesource.com](https://android.googlesource.com/platform/prebuilts/tools/) |
| **JUnit** | `4.13.2` | Test Dependency | **Eclipse Public License 1.0** | [junit.org/junit4](https://junit.org/junit4/) |
| **JSON in Java (org.json)** | `20240303` | Test Dependency | **Public Domain / JSON License** | [github.com/stleary/JSON-java](https://github.com/stleary/JSON-java) |

---

## 3. License Texts

### GNU General Public License, Version 3 (GPL-3.0)
Applicable to: **NewPipeExtractor** (`com.github.TeamNewPipe:NewPipeExtractor`)

```
                    GNU GENERAL PUBLIC LICENSE
                       Version 3, 29 June 2007

 Copyright (C) 2007 Free Software Foundation, Inc. <https://fsf.org/>
 Everyone is permitted to copy and distribute verbatim copies
 of this license document, but changing it is not allowed.

                            Preamble

  The GNU General Public License is a free, copyleft license for
software and other kinds of works.

  The licenses for most software and other practical works are designed
to take away your freedom to share and change the works.  By contrast,
the GNU General Public License is intended to guarantee your freedom to
share and change all versions of a program--to make sure it remains free
software for all its users.  We, the Free Software Foundation, use the
GNU General Public License for most of our software; it applies also to
any other work released this way by its authors.  You can apply it to
your programs, too.

  When we speak of free software, we are referring to freedom, not
price.  Our General Public Licenses are designed to make sure that you
have the freedom to distribute copies of free software (and charge for
them if you wish), that you receive source code or can get it if you
want it, that you can change the software or use pieces of it in new
free programs, and that you know you can do these things.

  To protect your rights, we need to prevent others from denying you
these rights or asking you to surrender the rights.  Therefore, you have
certain responsibilities if you distribute copies of the software, or if
you modify it: responsibilities to respect the freedom of others.

  For example, if you distribute copies of such a program, whether
gratis or for a fee, you must pass on to the recipients the same
freedoms that you received.  You must make sure that they, too, receive
or can get the source code.  And you must show them these terms so they
know their rights.

  Developers that use the GNU GPL protect your rights with two steps:
(1) assert copyright on the software, and (2) offer you this License
giving you legal permission to copy, distribute and/or modify it.

[Full license terms available at: https://www.gnu.org/licenses/gpl-3.0.txt]
```

---

### Apache License, Version 2.0 (Apache-2.0)
Applicable to: **AndroidX, OkHttp, Okio, Coil Compose, Kotlin Standard Library & Coroutines, nanojson, Desugar JDK Libs**

```
                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.
      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.
      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.
      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity.
      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.
      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.
      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.
      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work.
      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to use, reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      patent license to make, have made, use, offer to sell, sell, import,
      and otherwise transfer the Work.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:
      (a) You must give any other recipients of the Work or Derivative Works
          a copy of this License; and
      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and
      (c) You must retain, in the Source form of any Derivative Works that
          You distribute, all copyright, patent, trademark, and attribution
          notices from the Source form of the Work; and
      (d) If the Work includes a "NOTICE" text file as part of its distribution,
          then any Derivative Works that You distribute must include a readable
          copy of the attribution notices contained within such NOTICE file.

   [Full license text available at: http://www.apache.org/licenses/LICENSE-2.0]
```

---

### MIT License
Applicable to: **jsoup** (`org.jsoup:jsoup`)

```
The MIT License
Copyright (c) 2009-2026 Jonathan Hedley <jonathan@hedley.net>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

---

### BSD 3-Clause License
Applicable to: **Protocol Buffers [Java Lite]** (`com.google.protobuf:protobuf-javalite`)

```
Copyright 2008 Google Inc.  All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

    * Redistributions of source code must retain the above copyright
notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above
copyright notice, this list of conditions and the following disclaimer
in the documentation and/or other materials provided with the
distribution.
    * Neither the name of Google Inc. nor the names of its
contributors may be used to endorse or promote products derived from
this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

---

### Mozilla Public License, Version 2.0 (MPL-2.0)
Applicable to: **Mozilla Rhino** (`org.mozilla:rhino`, `org.mozilla:rhino-engine`)

```
                          Mozilla Public License Version 2.0
                          ==================================

1. Definitions
--------------
1.1. "Contributor"
     means each individual or legal entity that creates, contributes to
     the creation of, or owns Covered Software.
1.2. "Contributor Version"
     means the combination of the Contributions of others (if any) used
     by a Contributor and that particular Contributor's Contribution.
1.3. "Contribution"
     means Covered Software of a particular Contributor.
1.4. "Covered Software"
     means Source Code Form to which the initial Contributor has attached
     the notice in Exhibit A, the Executable Form of such Source Code
     Form, and Modifications of such Source Code Form, in each case
     including portions thereof.

2. License Grants and Conditions
--------------------------------
2.1. Grants
Each Contributor hereby grants You a world-wide, royalty-free,
non-exclusive license to use, reproduce, make available, modify, display,
perform, distribute, and otherwise exploit its Contributions.

[Full license text available at: https://www.mozilla.org/en-US/MPL/2.0/]
```

---

## 4. Trademarks and Disclaimers

- **YouTube** is a trademark of Google LLC. NovaDrop Android is an independent open-source project and is not affiliated with, sponsored by, or endorsed by Google LLC or YouTube.
- **TeamNewPipe / NewPipe** are trademarks and property of TeamNewPipe. NovaDrop Android utilizes the NewPipeExtractor library as an upstream dependency under GPL-3.0 and is not an official TeamNewPipe product.
- **Android, Google Play**, and the Google Play logo are trademarks of Google LLC.
