using System.Globalization;
using System.Net;
using System.Text.Json;
using Amazon.CloudWatchLogs;
using Amazon.CloudWatchLogs.Model;
using InvalidOperationException = System.InvalidOperationException;

namespace S3LogFileHandler.services;

public class LogService : ILogService
{
    private readonly ILogGroupService _logGroupService;
    private readonly IAmazonCloudWatchLogs _logsClient;
    private readonly ILogStreamService _logStreamService;

    public LogService(
        IAmazonCloudWatchLogs logsClient,
        ILogGroupService logGroupService,
        ILogStreamService logStreamService)
    {
        _logsClient = logsClient;
        _logGroupService = logGroupService;
        _logStreamService = logStreamService;
    }

    public void ProcessLogs(List<Dictionary<string, string>> logData)
    {
        var logGroupName = _logGroupService.ManageLogGroups();
        var logStreamName = _logStreamService.ManageLogStreams();
        PutLogEvents(logData, logGroupName, logStreamName);
    }

    private void PutLogEvents(List<Dictionary<string, string>> logData, string logGroupName,
        string logStreamName)
    {
        const int maxBatchSize = 1048576;
        const int maxBatchCount = 10000;
        const int logEventOverhead = 26;

        var batches = new List<List<InputLogEvent>>();
        var batch = new List<InputLogEvent>();
        var batchSize = 0;

        foreach (var line in logData)
        {
            var serializedLine = JsonSerializer.Serialize(line);
            var eventSize = serializedLine.Length + logEventOverhead;
            batchSize += eventSize;
            if (batchSize >= maxBatchSize || batch.Count >= maxBatchCount)
            {
                batches.Add(batch);
                batch = new List<InputLogEvent>();
                batchSize = eventSize;
            }

            line.TryGetValue("timestamp", out var timestamp);

            if (timestamp is null) throw new InvalidOperationException("Could not find timestamp in the list");

            const string format = "yyyy-MM-ddTHH:mm:ss";
            var ts = DateTime.ParseExact(timestamp, format, CultureInfo.InvariantCulture);

            batch.Add(new InputLogEvent
            {
                Message = serializedLine,
                Timestamp = ts
            });
        }

        batches.Add(batch);
        Console.WriteLine($"Batch count is: {batches.Count}");

        SendBatches(batches, logGroupName, logStreamName);
    }

    private void SendBatches(List<List<InputLogEvent>> batches, string logGroupName,
        string logStreamName)
    {
        var sentBatches = 0;
        foreach (var batch in batches)
        {
            SendBatch(batch, logGroupName, logStreamName);
            sentBatches++;
        }

        if (sentBatches == batches.Count) Console.WriteLine("Successfully sent all batches");
    }

    private void SendBatch(IEnumerable<InputLogEvent> batch, string logGroupName, string logStreamName)
    {
        var request = new PutLogEventsRequest
        {
            LogEvents = batch.OrderBy(o => o.Timestamp).ToList(),
            LogGroupName = logGroupName,
            LogStreamName = logStreamName
        };

        var result = _logsClient.PutLogEventsAsync(request);

        if (result.Result.HttpStatusCode != HttpStatusCode.OK)
            Console.WriteLine($"Failed to save batch to stream {logStreamName} in group {logGroupName}");
    }
}
