using Amazon.CloudWatchLogs;
using Amazon.Lambda.Core;
using Amazon.Lambda.S3Events;
using Amazon.S3;
using Amazon.S3.Model;
using S3LogFileHandler;
using S3LogFileHandler.services;

// Assembly attribute to enable the Lambda function's JSON input to be converted into a .NET class.
[assembly: LambdaSerializer(typeof(DefaultLambdaJsonSerializer))]

namespace CloudFrontLogForwarder;

public class Functions
{
    private readonly string? _logGroupName;
    private readonly LogService _logService;
    private readonly string? _logStreamName;

    /// <summary>
    ///     Default constructor. This constructor is used by Lambda to construct the instance. When invoked in a Lambda
    ///     environment
    ///     the AWS credentials will come from the IAM role associated with the function and the AWS region will be set to the
    ///     region the Lambda function is executed in.
    /// </summary>
    public Functions()
    {
        S3Client = new AmazonS3Client();
        CloudWatchLogsClient = new AmazonCloudWatchLogsClient();
        _logGroupName = Environment.GetEnvironmentVariable("logGroupName");
        _logStreamName = Environment.GetEnvironmentVariable("logStreamName");

        _logService = new LogService(
            CloudWatchLogsClient,
            new LogGroupService(CloudWatchLogsClient, _logGroupName),
            new LogStreamService(CloudWatchLogsClient, _logGroupName, _logStreamName)
        );
    }

    /// <summary>
    ///     Constructs an instance with a preconfigured S3 client. This can be used for testing outside of the Lambda
    ///     environment.
    /// </summary>
    /// <param name="s3Client"></param>
    /// <param name="cloudWatchLogsClient"></param>
    public Functions(IAmazonS3 s3Client, AmazonCloudWatchLogsClient cloudWatchLogsClient)
    {
        S3Client = s3Client;
        CloudWatchLogsClient = cloudWatchLogsClient;
        _logGroupName = Environment.GetEnvironmentVariable("logGroupName");
        _logStreamName = Environment.GetEnvironmentVariable("logStreamName");

        _logService = new LogService(
            CloudWatchLogsClient,
            new LogGroupService(CloudWatchLogsClient, _logGroupName),
            new LogStreamService(CloudWatchLogsClient, _logGroupName, _logStreamName)
        );
    }

    private IAmazonS3 S3Client { get; }
    private AmazonCloudWatchLogsClient CloudWatchLogsClient { get; }

    public static void Main()
    {
        throw new NotSupportedException();
    }

    /// <summary>
    ///     This method is called for every Lambda invocation. This method takes in an S3 event object and can be used
    ///     to respond to S3 notifications.
    /// </summary>
    /// <param name="event"></param>
    /// <param name="context"></param>
    /// <returns></returns>
    public void FunctionHandler(S3Event @event, ILambdaContext context)
    {
        context.Logger.LogInformation("Running Function.cs...");
        context.Logger.LogInformation($"LogGroup is {_logGroupName}, LogStream is {_logStreamName}");

        var eventRecords = @event.Records ?? new List<S3Event.S3EventNotificationRecord>();

        context.Logger.LogDebug($"EventRecords.Count: {eventRecords.Count}");

        foreach (var s3Event in eventRecords.Select(record => record.S3))
        {
            context.Logger.LogDebug($"EventRecord: object {s3Event.Object.Key} from bucket {s3Event.Bucket.Name}");
            try
            {
                context.Logger.LogDebug("Try get object metadata");

                var metadataResponse = S3Client.GetObjectMetadataAsync(s3Event.Bucket.Name, s3Event.Object.Key);

                context.Logger.LogDebug($"S3 object content type is: {metadataResponse.Result.Headers.ContentType}");
                
                try
                {
                    context.Logger.LogDebug("Trying to load gzip file");

                    var response = S3Client.GetObjectAsync(s3Event.Bucket.Name, s3Event.Object.Key).Result;
                    
                    context.Logger.LogDebug($"response status code is: {response.HttpStatusCode}");
                    context.Logger.LogDebug($"response stream length is {response.ResponseStream.Length}");
                    context.Logger.LogDebug("Start processing file");

                    var logData = FileStreamProcessor.Process(response.ResponseStream);

                    context.Logger.LogDebug(
                        $"File processing completed. Number of processed log lines is: {logData.Count}");
                    context.Logger.LogDebug("Start processing logs");

                    _logService.ProcessLogs(logData);
                }
                catch (Exception e)
                {
                    context.Logger.LogError(e.Message);
                }
            }
            catch (Exception e)
            {
                context.Logger.LogError(
                    $"Error processing logs from object {s3Event.Object.Key} in bucket {s3Event.Bucket.Name}. Make sure they exist and your bucket is in the same region as this function.");
                context.Logger.LogError(e.Message);
                context.Logger.LogError(e.StackTrace);
                throw;
            }
            finally
            {
                context.Logger.LogInformation("Function execution complete :)");
            }
        }
    }
}
