using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using TS3Gifbox.Entities;
using TS3Gifbox.Logging;
using TS3Gifbox.Services.Contracts;

namespace TS3Gifbox.Services
{
    class VideoConverterService : IVideoConverterService
    {
        private readonly TraceSource _logger;

        public VideoConverterService(TraceSource logger)
        {
            _logger = logger;
        }

        public async Task<string> ConvertFile(string input)
        {
            using (LogicalOperationScope operation = new LogicalOperationScope("Conversion"))
            {
                _logger.TraceEvent(TraceEventType.Information, 0, "Converting file {0}", input);

                // Common formatable string for temporary (or final) file names, to be declined for each step
                string baseOutputPath = Path.Combine
                (
                    CupHolder.TargetPath,
                    Path.ChangeExtension
                    (
                        Path.GetFileNameWithoutExtension(input) + "-{0}",
                        ".gif"
                    )
                );

                string FFmpegOutputPath = string.Format(baseOutputPath, "FFmpeg");

                string convertOutputPath = string.Format(baseOutputPath, "convert");

                string gifsicleOutputPath = string.Format(baseOutputPath, "gifsicle");

                // Run ffmpeg
                await FFmpeg(input, FFmpegOutputPath);

                // Run imagemagick convert
                await ImagemagickConvert(FFmpegOutputPath, convertOutputPath);

                // Run gifsicle
                await Gifsicle(convertOutputPath, gifsicleOutputPath);

                _logger.TraceEvent(TraceEventType.Information, 0, "Trying to remove temporary files", input);
                RemoveTemporaryFile(FFmpegOutputPath);
                RemoveTemporaryFile(convertOutputPath);

                _logger.TraceEvent(TraceEventType.Information, 0, "Done converting file", input);

                return gifsicleOutputPath;
            }
        }

        private void RemoveTemporaryFile(string temporaryFile)
        {
            try
            {
                File.Delete(temporaryFile);
            }
            catch (Exception e)
            {
                _logger.TraceEvent(TraceEventType.Error, 0,@" Couldn't remove temporary file ({0}).

Exception: {1}", temporaryFile, e);
            }
        }

        private async Task FFmpeg(string input, string output)
        {
            _logger.TraceEvent(TraceEventType.Information, 0, "Using FFmpeg (input: {0}, output: {1})", input, output);
            List<string> args = new List<string>
            {
                "-y",
                string.Format("-i \"{0}\"", input),
                "-pix_fmt rgb24",
                "-r 10",
                "-s 320x240",
                string.Format("\"{0}\"", output),
            };

            string processExecutable = CupHolder.FFmpegExecutablePath;

            await RunWorkerProcess(processExecutable, args);
        }

        private async Task ImagemagickConvert(string input, string output)
        {
            _logger.TraceEvent(TraceEventType.Information, 0, "Using imagemagick converter (input: {0}, output: {1})", input, output);
            List<string> args = new List<string>
            {
                string.Format("\"{0}\"", input),
                "-verbose",
                "-fuzz 10%",
                "-layers Optimize",
                string.Format("\"{0}\"", output),
            };

            string processExecutable = CupHolder.ImageMagickConvertExecutablePath;

            await RunWorkerProcess(processExecutable, args);
        }

        private async Task Gifsicle(string input, string output)
        {
            _logger.TraceEvent(TraceEventType.Information, 0, "Using gifsicle (input: {0}, output: {1})", input, output);

            List<string> args = new List<string>
            {
                "--optimize=3",
                "--loopcount",
                string.Format("\"{0}\"", input),
                string.Format("-o \"{0}\"", output)
            };

            string processExecutable = CupHolder.GifsicleExecutablePath;

            await RunWorkerProcess(processExecutable, args);
        }

        private async Task RunWorkerProcess(string processExecutable, List<string> args)
        {
            Process process = null;

            try
            {
                string argString = string.Join(" ", args);
                ProcessStartInfo processInfo = new ProcessStartInfo
                {
                    FileName = processExecutable,
                    Arguments = argString,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true
                };

                process = Process.Start(processInfo);
                await process.WaitForExitAsync();

                if (process.ExitCode != 0)
                {
                    string errorMessage = string.Format("Expected process to return 0, returned {0}", process.ExitCode);

                    throw new InvalidProgramException(errorMessage);
                }
            }
            catch (Exception e)
            {
                string processStandardOutput = null;
                string processStandardError = null;

                if (process != null)
                {
                    try
                    {
                        processStandardOutput = process.StandardOutput.ReadToEnd();
                        processStandardError = process.StandardError.ReadToEnd();
                    }
                    catch { }
                }

                _logger.TraceEvent(TraceEventType.Error,
                    0,
                    CupHolder.Constants.ErrorMessages.WorkerProcess,
                    Path.GetFileNameWithoutExtension(processExecutable),
                    processStandardOutput,
                    processStandardError,
                    e);

                throw;
            }
        }
    }
}
