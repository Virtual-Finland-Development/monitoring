using System.Net;
using Amazon.CloudWatchLogs;
using Amazon.CloudWatchLogs.Model;

namespace S3LogFileHandler.services;

public class LogGroupService : ILogGroupService
{
    private readonly string _logGroupName;

    private readonly IAmazonCloudWatchLogs _logsClient;

    public LogGroupService(IAmazonCloudWatchLogs logsClient, string? logGroupName)
    {
        _logsClient = logsClient;
        _logGroupName = logGroupName ?? throw new InvalidParameterException(nameof(logGroupName));
    }

    public string ManageLogGroups()
    {
        var result = _logsClient.DescribeLogGroupsAsync(new DescribeLogGroupsRequest
            { LogGroupNamePrefix = _logGroupName });

        if (result.Result.HttpStatusCode != HttpStatusCode.OK)
        {
            Console.WriteLine("Error while describing log group. Try to create new log group");
            CreateLogGroup(_logGroupName);
        }

        if (result.Result.LogGroups.Count == 0)
        {
            Console.WriteLine($"There are no existing log groups. Try to create new log group {_logGroupName}");
            CreateLogGroup(_logGroupName);
        }
        else
        {
            Console.WriteLine($"Success while describing log group: {_logGroupName}");
        }

        return _logGroupName;
    }

    private void CreateLogGroup(string name)
    {
        var result = _logsClient.CreateLogGroupAsync(new CreateLogGroupRequest
        {
            LogGroupName = name
        });

        if (result.Result.HttpStatusCode != HttpStatusCode.OK)
        {
            Console.WriteLine($"Error while creating log group: {name}");
            return;
        }

        Console.WriteLine($"Successfully created log group: {name}");
    }
}
