using System.IO.Compression;
using System.Text.Json;

namespace S3LogFileHandler;

public static class FileStreamProcessor
{
    public static List<Dictionary<string, string>> Process(Stream stream, bool printJson = false)
    {
        if (stream == null) throw new ArgumentNullException(nameof(stream));

        Console.WriteLine($"Trying to unzip stream (lenght: {stream.Length}");

        Stream uncompressedStream = new MemoryStream();

        try
        {
            using var gZipStream = new GZipStream(stream, CompressionMode.Decompress);
            gZipStream.CopyTo(uncompressedStream);
            uncompressedStream.Position = 0;
            Console.WriteLine($"gzip base stream lenght: {gZipStream.BaseStream.Length}");
        }
        catch (Exception e)
        {
            Console.WriteLine($"Failed to unzip stream with message {e.Message}");
        }

        Console.WriteLine($"Unzipped stream length: {uncompressedStream.Length}");

        var result = ProcessStream(uncompressedStream);

        MergeDateAndTimeToTimestamp(result);

        if (printJson) Console.WriteLine($"{JsonSerializer.Serialize(result)}");

        return result;
    }

    public static List<Dictionary<string, string>> Process(string fileName, bool printJson = false)
    {
        var decompressedLogsFileName = DecompressLogsToFile(fileName);
        using var simpleFile = File.OpenRead(decompressedLogsFileName);

        var result = ProcessStream(simpleFile);

        MergeDateAndTimeToTimestamp(result);

        if (printJson) Console.WriteLine($"{JsonSerializer.Serialize(result)}");

        return result;
    }

    private static List<Dictionary<string, string>> ProcessStream(Stream stream)
    {
        Console.WriteLine("Start ProcessStream()");
        var result = new List<Dictionary<string, string>>();

        using var sr = new StreamReader(stream);

        var version = sr.ReadLine()?[10..];

        Console.WriteLine($"Log file version is {version}");

        var fields = sr.ReadLine()?[9..]?.Split(" ");
        if (fields is null) throw new InvalidOperationException($"{nameof(fields)} cannot be null");

        while (!sr.EndOfStream)
        {
            var line = sr.ReadLine();

            if (line is null) continue;

            var lineItems = line.Split("\t");

            if (lineItems.Length != fields.Length)
            {
                Console.WriteLine($"{lineItems.Length}");
                Console.WriteLine($"{fields.Length}");
                Console.WriteLine($"{line}");
                throw new InvalidOperationException("Field counts don't match");
            }

            var logLineItems = new Dictionary<string, string>();
            for (var i = 0; i < fields.Length; i++) logLineItems.Add(fields[i], lineItems[i]);
            result.Add(logLineItems);
        }

        Console.WriteLine($"Log file contains {result.Count} lines");

        return result;
    }

    private static void MergeDateAndTimeToTimestamp(List<Dictionary<string, string>> lines)
    {
        foreach (var line in lines)
        {
            line.TryGetValue("date", out var date);
            line.TryGetValue("time", out var time);

            var timestamp = $"{date}T{time}";

            line.Remove("date");
            line.Remove("time");

            line.Add("timestamp", timestamp);
        }
    }

    private static string DecompressLogsToFile(string originalFile)
    {
        using var cloudFrontLogs = File.Open(originalFile, FileMode.Open);
        using var decompressedLogs = File.Create($"decompressed-{originalFile}.txt");

        using var gZipStream = new GZipStream(cloudFrontLogs, CompressionMode.Decompress);
        gZipStream.CopyTo(decompressedLogs);

        return decompressedLogs.Name;
    }
}
