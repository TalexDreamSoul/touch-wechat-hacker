#!/usr/bin/env swift
import Foundation
import AppKit

func fail(_ message: String) -> Never {
    FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
    exit(1)
}

let args = CommandLine.arguments
if args.count < 4 {
    fail("usage: make-icon.swift <output.icns> <hex-color> <label>")
}

let output = URL(fileURLWithPath: args[1]).standardizedFileURL
let hex = args[2].trimmingCharacters(in: CharacterSet(charactersIn: "#"))
let rawLabel = args[3]
let label = rawLabel.isEmpty ? "微" : String(rawLabel.prefix(2))

func colorFromHex(_ hex: String) -> NSColor {
    var value: UInt64 = 0
    Scanner(string: hex).scanHexInt64(&value)
    let r, g, b: CGFloat
    if hex.count >= 6 {
        r = CGFloat((value >> 16) & 0xff) / 255.0
        g = CGFloat((value >> 8) & 0xff) / 255.0
        b = CGFloat(value & 0xff) / 255.0
    } else {
        r = 0.10; g = 0.66; b = 0.31
    }
    return NSColor(calibratedRed: r, green: g, blue: b, alpha: 1)
}

let baseColor = colorFromHex(hex)
let iconset = output.deletingPathExtension().appendingPathExtension("iconset")
try? FileManager.default.removeItem(at: iconset)
try FileManager.default.createDirectory(at: iconset, withIntermediateDirectories: true)

let specs: [(String, CGFloat)] = [
    ("icon_16x16.png", 16),
    ("icon_16x16@2x.png", 32),
    ("icon_32x32.png", 32),
    ("icon_32x32@2x.png", 64),
    ("icon_128x128.png", 128),
    ("icon_128x128@2x.png", 256),
    ("icon_256x256.png", 256),
    ("icon_256x256@2x.png", 512),
    ("icon_512x512.png", 512),
    ("icon_512x512@2x.png", 1024)
]

for (name, px) in specs {
    let size = NSSize(width: px, height: px)
    let image = NSImage(size: size)
    image.lockFocus()

    NSColor.clear.setFill()
    NSRect(origin: .zero, size: size).fill()

    let inset = px * 0.055
    let rect = NSRect(x: inset, y: inset, width: px - inset * 2, height: px - inset * 2)
    let radius = px * 0.22
    baseColor.setFill()
    NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius).fill()

    // Soft top highlight
    NSColor(calibratedWhite: 1, alpha: 0.16).setFill()
    let highlight = NSBezierPath(roundedRect: NSRect(x: inset, y: px * 0.52, width: px - inset * 2, height: px * 0.40), xRadius: radius, yRadius: radius)
    highlight.fill()

    // Tiny chat bubble circles, WeChat-ish but not using the original asset.
    if px >= 64 {
        NSColor(calibratedWhite: 1, alpha: 0.22).setFill()
        NSBezierPath(ovalIn: NSRect(x: px * 0.16, y: px * 0.60, width: px * 0.28, height: px * 0.20)).fill()
        NSBezierPath(ovalIn: NSRect(x: px * 0.48, y: px * 0.50, width: px * 0.32, height: px * 0.23)).fill()
    }

    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = .center
    let fontSize = px * (label.count == 1 ? 0.44 : 0.34)
    let attrs: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: fontSize, weight: .bold),
        .foregroundColor: NSColor.white,
        .paragraphStyle: paragraph
    ]
    let textRect = NSRect(x: px * 0.08, y: px * 0.18, width: px * 0.84, height: px * 0.52)
    (label as NSString).draw(in: textRect, withAttributes: attrs)

    image.unlockFocus()

    guard let tiff = image.tiffRepresentation,
          let rep = NSBitmapImageRep(data: tiff),
          let png = rep.representation(using: .png, properties: [:]) else {
        fail("failed to render png")
    }
    try png.write(to: iconset.appendingPathComponent(name))
}

try? FileManager.default.removeItem(at: output)
let proc = Process()
proc.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
proc.arguments = ["-c", "icns", iconset.path, "-o", output.path]
try proc.run()
proc.waitUntilExit()
try? FileManager.default.removeItem(at: iconset)
if proc.terminationStatus != 0 {
    fail("iconutil failed: \(proc.terminationStatus)")
}
