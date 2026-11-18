package com.safeyatra.app.mesh

import java.nio.ByteBuffer
import java.security.SecureRandom
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

object CryptoUtils {
    const val EID_ROTATION_SECONDS = 900 // 15-minute slot
    const val EID_LENGTH = 16

    fun generateRotatingEID(masterSecret: String, epochSeconds: Long): ByteArray {
        return try {
            val window = epochSeconds / EID_ROTATION_SECONDS
            val keyBytes = masterSecret.toByteArray(Charsets.UTF_8)
            val hmac = Mac.getInstance("HmacSHA256").apply {
                init(SecretKeySpec(keyBytes, "HmacSHA256"))
            }
            val timeBytes = ByteBuffer.allocate(8).putLong(window).array()
            hmac.doFinal(timeBytes).copyOfRange(0, EID_LENGTH)
        } catch (e: Exception) {
            ByteArray(EID_LENGTH)
        }
    }

    fun bytesToHex(bytes: ByteArray): String =
        bytes.joinToString("") { "%02X".format(it) }

    fun generateMasterSecret(): String {
        val bytes = ByteArray(32)
        SecureRandom().nextBytes(bytes)
        return bytesToHex(bytes)
    }
}

