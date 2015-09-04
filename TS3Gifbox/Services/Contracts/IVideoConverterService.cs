using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using TS3Gifbox.Entities;

namespace TS3Gifbox.Services.Contracts
{
    public interface IVideoConverterService
    {
        /// <summary>
        /// Converts the input file to gif file
        /// </summary>
        /// <param name="input">the file to convert</param>
        /// <returns>the converted file path</returns>
        Task<string> ConvertFile(string input);
    }
}
