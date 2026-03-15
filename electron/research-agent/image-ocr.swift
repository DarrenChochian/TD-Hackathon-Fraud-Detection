import Foundation
import ImageIO
import Vision

enum OCRError: Error {
  case missingPath
  case loadFailed
  case cgImageUnavailable
}

func loadCGImage(from filePath: String) throws -> CGImage {
  let url = URL(fileURLWithPath: filePath)
  guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else {
    throw OCRError.loadFailed
  }

  guard let cgImage = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
    throw OCRError.cgImageUnavailable
  }

  return cgImage
}

func main() throws {
  guard CommandLine.arguments.count >= 2 else {
    throw OCRError.missingPath
  }

  let cgImage = try loadCGImage(from: CommandLine.arguments[1])
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.usesLanguageCorrection = true

  let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
  try handler.perform([request])

  let observations = request.results ?? []
  let lines = observations.compactMap { $0.topCandidates(1).first?.string }
  FileHandle.standardOutput.write(lines.joined(separator: "\n").data(using: .utf8) ?? Data())
}

do {
  try main()
} catch {
  let message = String(describing: error)
  FileHandle.standardError.write(message.data(using: .utf8) ?? Data())
  exit(1)
}
