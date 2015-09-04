using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TS3Gifbox.Entities
{
    internal static class CupHolder
    {
        /// <summary>
        /// The source path from which the files will be taken and converted.
        /// </summary>
        public static string SourcePath;

        /// <summary>
        /// The target path to which the converted files will be written
        /// </summary>
        public static string TargetPath;

        /// <summary>
        /// The path to the FFmpeg executable
        /// </summary>
        public static string FFmpegExecutablePath;

        /// <summary>
        /// The path to the ImageMagick Convert executable
        /// </summary>
        public static string ImageMagickConvertExecutablePath;

        /// <summary>
        /// The path to the Gifsicle executable
        /// </summary>
        public static string GifsicleExecutablePath;

        public static class Constants
        {
            public static class ErrorMessages
            {
                public const string WorkerProcess = @"An error occured while calling {0} on the input file.

Standard output:
{1}

Error output:
{2}

Exception:
{3}";
                public const string Conversion = @"An error occured while converting file {0}. Aborting operation.

Exception:
{1}";
            }
        }
    }
}
