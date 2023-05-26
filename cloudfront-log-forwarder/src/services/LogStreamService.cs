using System.Net;
using Amazon.CloudWatchLogs;
using Amazon.CloudWatchLogs.Model;

namespace S3LogFileHandler.services;

public class LogStreamService : ILogStreamService
{
    private readonly string _logGroupName;
    private readonly IAmazonCloudWatchLogs _logsClient;
    private readonly string _logStreamName;

    public LogStreamService(IAmazonCloudWatchLogs logsClient, string? logGroupName, string? logStreamName)
    {
        _logsClient = logsClient;
        _logGroupName = logGroupName ?? throw new InvalidParameterException(nameof(logGroupName));
        _logStreamName = logStreamName ?? throw new InvalidParameterException(nameof(logStreamName));
    }

    public string ManageLogStreams()
    {
        var now = DateTime.UtcNow;
        var streamName = $"{now.Year}/{now.Month}/{now.Day}/{_logStreamName}/{Guid.NewGuid()}";

        var result = _logsClient.DescribeLogStreamsAsync(new DescribeLogStreamsRequest
        {
            LogGroupName = _logGroupName,
            LogStreamNamePrefix = streamName
        });

        if (result.Result.HttpStatusCode != HttpStatusCode.OK)
        {
            Console.WriteLine("Error while describing log stream");
        }
        else
        {
            if (result.Result.LogStreams.Count == 0)
            {
                Console.WriteLine("Need to create log stream");
                CreateLogStream(streamName);
            }
            else
            {
                Console.WriteLine($"Log stream already defined: {streamName}");
            }
        }

        return streamName;
    }

    private void CreateLogStream(string streamName)
    {
        var result = _logsClient.CreateLogStreamAsync(new CreateLogStreamRequest
        {
            LogGroupName = _logGroupName,
            LogStreamName = streamName
        });

        if (result.Result.HttpStatusCode != HttpStatusCode.OK)
        {
            Console.WriteLine("Error while creating log stream");
            return;
        }

        Console.WriteLine($"Success in creating log stream: {streamName}");
    }
}
